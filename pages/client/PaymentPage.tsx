import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import reservationsApi from '../../services/reservationsApi';
import eventsApi from '../../services/eventsApi';
import paymentsApi from '../../services/paymentsApi';
import { useKeycloak } from '../../hooks/useKeycloak';
import { Button } from '../../components/ui/Button';
import { joinReservationChannel, leaveReservationChannel, joinUserChannel, leaveUserChannel, registerPaymentResultHandler, registerServiceStatusHandler, type ServiceStatusPayload } from '../../services/notificationHubClient';
import { getReservationServiceStatuses, setReservationServiceStatuses } from '../../services/serviceStatusCache';
import { useI18n } from '../../i18n';

type ServiceStatusState = {
  serviceId: number;
  name: string;
  price: number;
  status: string;
  updatedAt?: string;
};

export const PaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state || {}) as any;
  const existingReservation = state?.existingReservation;
  const { selectedSeats = [], evento, zonasMap = {}, selectedServiceIds = [], selectedServices = [], subtotal = 0, servicesTotal = 0, total = 0 } = state;
  const streamingPrice = Number((state as any)?.streamingPrice ?? (evento as any)?.generalPrice ?? existingReservation?.total ?? 0) || 0;
  const isStreamingEvent = (evento as any)?.eventFormat === 'streaming';
  const { holdToken, holdExpires } = state as any;
  const { profile } = useKeycloak();
  const { t } = useI18n();

  const normalizedSelectedServices = React.useMemo(() => {
    return (selectedServices || []).map((s: any) => ({
      serviceId: Number(s.id ?? s.Id ?? s.serviceId ?? 0),
      name: s.name ?? s.Name ?? 'Servicio adicional',
      price: Number(s.price ?? s.Price ?? 0)
    })).filter(s => s.serviceId > 0);
  }, [selectedServices]);

  const [serviceStatuses, setServiceStatuses] = React.useState<ServiceStatusState[]>(() =>
    normalizedSelectedServices.map(s => ({ ...s, status: 'PENDING' }))
  );
  const reservationIdRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (reservationIdRef.current) return;
    setServiceStatuses(normalizedSelectedServices.map(s => ({ ...s, status: 'PENDING' })));
  }, [normalizedSelectedServices]);

  const formatEventLocal = (fecha?: string, hora?: string | null) => {
    if (!fecha) return 'Fecha no disponible';
    try {
      const [y, m, d] = fecha.split('-').map(Number);
      if (hora) {
        const [hh, mm] = hora.split(':').map(Number);
        const dt = new Date(y, m - 1, d, hh ?? 0, mm ?? 0);
        return dt.toLocaleString();
      }
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString();
    } catch {
      return fecha;
    }
  };

  const [paymentMethods, setPaymentMethods] = React.useState<Array<{ id: number; type: string; detail: string }>>([]);
  const [method, setMethod] = React.useState<string>('');
  const [processing, setProcessing] = React.useState(false);
  const [couponCode, setCouponCode] = React.useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = React.useState<any | null>(null);
  const [discountAmount, setDiscountAmount] = React.useState<number>(0);
  const [holdRemaining, setHoldRemaining] = React.useState<number | null>(() => {
    if (!holdExpires) return null;
    const t = new Date(holdExpires).getTime();
    if (isNaN(t)) return null;
    return Math.max(0, Math.floor((t - Date.now()) / 1000));
  });
  const [reservationId, setReservationId] = React.useState<number | null>(null);
  const [paymentId, setPaymentId] = React.useState<number | null>(null);
  const [paymentStatus, setPaymentStatus] = React.useState<'idle' | 'creating' | 'pending' | 'approved' | 'rejected' | 'error'>('idle');
  const [paymentDetail, setPaymentDetail] = React.useState('');
  const [waitingNotification, setWaitingNotification] = React.useState(false);
  const paymentHandlerCleanup = React.useRef<(() => void) | null>(null);
  const serviceHandlerCleanup = React.useRef<(() => void) | null>(null);

  const clearHoldCache = React.useCallback(() => {
    if (!evento?.id) return;
    try {
      sessionStorage.removeItem(`seat_hold_expiry_${evento.id}`);
      sessionStorage.removeItem(`seat_hold_selected_${evento.id}`);
    } catch {
      /* ignore */
    }
  }, [evento?.id]);

  React.useEffect(() => {
    return () => {
      if (paymentHandlerCleanup.current) {
        paymentHandlerCleanup.current();
        paymentHandlerCleanup.current = null;
      }
      if (serviceHandlerCleanup.current) {
        serviceHandlerCleanup.current();
        serviceHandlerCleanup.current = null;
      }
      if (reservationIdRef.current) {
        void leaveReservationChannel(reservationIdRef.current);
      }
      if (profile?.id) {
        void leaveUserChannel(profile.id);
      }
    };
  }, [profile?.id]);

  const bootstrapServiceStatuses = React.useCallback((resId: number) => {
    if (!resId) return;
    reservationIdRef.current = resId;
    const cached = getReservationServiceStatuses(resId);
    if (cached && cached.length > 0) {
      setServiceStatuses(cached);
      return;
    }
    const seeded = normalizedSelectedServices.map(s => ({ ...s, status: 'PENDING', updatedAt: new Date().toISOString() }));
    setServiceStatuses(seeded);
    setReservationServiceStatuses(resId, seeded);
  }, [normalizedSelectedServices]);

  const attachServiceStatusListener = React.useCallback(async (resId: number) => {
    if (serviceHandlerCleanup.current) {
      serviceHandlerCleanup.current();
      serviceHandlerCleanup.current = null;
    }

    if (normalizedSelectedServices.length === 0) {
      return;
    }

    const handler = (payload: ServiceStatusPayload) => {
      if (!payload) return;
      const payloadReservationId = Number(payload.reservationId ?? (payload as any).ReservationId ?? 0);
      if (payloadReservationId !== Number(resId)) {
        return;
      }

      const serviceId = Number(payload.serviceId ?? (payload as any).ServiceId ?? 0);
      if (!serviceId) {
        return;
      }

      const status = String(payload.status ?? (payload as any).Status ?? 'CONFIRMED').toUpperCase();
      const updatedAt = new Date().toISOString();
      const emittedName = payload.serviceName ?? (payload as any).ServiceName;
      const emittedPrice = payload.price ?? (payload as any).ServicePrice;

      setServiceStatuses(prev => {
        let handled = false;
        const next = prev.map(entry => {
          if (entry.serviceId !== serviceId) {
            return entry;
          }

          handled = true;
          return {
            ...entry,
            status,
            updatedAt,
            name: emittedName || entry.name,
            price: Number(emittedPrice ?? entry.price ?? 0)
          };
        });

        let result = next;
        if (!handled) {
          const fallback = normalizedSelectedServices.find(s => s.serviceId === serviceId) ?? {
            serviceId,
            name: emittedName ?? `Servicio #${serviceId}`,
            price: Number(emittedPrice ?? 0)
          };
          result = [...next, { ...fallback, status, updatedAt }];
        }

        if (reservationIdRef.current) {
          setReservationServiceStatuses(reservationIdRef.current, result);
        }

        return result;
      });
    };

    const unsubscribe = await registerServiceStatusHandler(handler);
    serviceHandlerCleanup.current = unsubscribe;
  }, [normalizedSelectedServices]);

  const attachPaymentListener = React.useCallback(async (resId: number) => {
    if (paymentHandlerCleanup.current) {
      paymentHandlerCleanup.current();
      paymentHandlerCleanup.current = null;
    }

    const handler = (payload: any) => {
      if (!payload) return;
      if (Number(payload.reservationId ?? payload.reservationID) !== Number(resId)) {
        return;
      }

      setWaitingNotification(false);
      const normalized = String(payload.status ?? '').toUpperCase();
      const detail = payload.detail ?? payload.message ?? payload.paymentMessage ?? '';

      if (normalized === 'APPROVED') {
        setPaymentStatus('approved');
        setPaymentDetail(detail || t('payment.status.approved'));
        clearHoldCache();
        setTimeout(() => {
          navigate('/perfil', { state: { highlightReservation: resId } });
        }, 2000);
      } else {
        setPaymentStatus('rejected');
        setPaymentDetail(detail || t('payment.status.rejected'));
      }
    };

    const unsubscribe = await registerPaymentResultHandler(handler);
    paymentHandlerCleanup.current = unsubscribe;

    await attachServiceStatusListener(resId);

    await joinReservationChannel(resId);
    if (profile?.id) {
      await joinUserChannel(profile.id);
    }
  }, [profile?.id, clearHoldCache, navigate, attachServiceStatusListener]);

  React.useEffect(() => {
    let mounted = true;
    paymentsApi.getPaymentMethods()
      .then((list) => {
        if (!mounted) return;
        setPaymentMethods(list || []);
        if (!method && list?.length) {
          setMethod(String(list[0].id));
        }
      })
      .catch((err) => console.error('Error cargando métodos de pago', err));
    return () => { mounted = false; };
  }, [method]);

  // update countdown every second
  React.useEffect(() => {
    if (!holdExpires) return;
    let mounted = true;
    const tick = () => {
      const t = new Date(holdExpires).getTime();
      if (isNaN(t)) { setHoldRemaining(null); return; }
      const secs = Math.max(0, Math.floor((t - Date.now()) / 1000));
      if (mounted) setHoldRemaining(secs);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => { mounted = false; clearInterval(iv); };
  }, [holdExpires]);

  if (!evento && !existingReservation) {
    return (
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold">{t('payment.status.pending')}</h1>
        <Button onClick={() => navigate('/')}>{t('checkout.noSeats.backHome')}</Button>
      </div>
    );
  }

  const seatsForSummary = selectedSeats.length > 0 ? selectedSeats : (existingReservation?.seats ?? []);
  const seatsSubtotal = seatsForSummary.reduce((acc: number, s: any) => {
    const price = zonasMap?.[s.zonaId]?.precio ?? s.precio ?? 0;
    return acc + Number(price || 0);
  }, 0);
  const effectiveSubtotal = seatsForSummary.length > 0 ? seatsSubtotal : (streamingPrice || subtotal || existingReservation?.total || 0);
  const effectiveTotal = Number((effectiveSubtotal + servicesTotal - discountAmount).toFixed(2));

  const handleConfirmPayment = async () => {
    if (processing) return;
    if (!method) {
      alert(t('payment.selectMethod'));
      return;
    }

    const amountToCharge = Number(((existingReservation?.total ?? effectiveTotal)).toFixed(2));
    setProcessing(true);
    setPaymentStatus('creating');
    setPaymentDetail(t('payment.processing'));
    setWaitingNotification(false);
    setPaymentId(null);

    try {
      let createdReservationId = existingReservation?.id ?? existingReservation?.reservationId ?? null;
      if (!createdReservationId) {
        const payload: any = {
          date: new Date().toISOString().slice(0,10),
          state: 'pending',
          eventoId: evento?.id,
          total: amountToCharge,
          additionalServiceIds: selectedServiceIds,
          seats: selectedSeats.map((s: any) => ({ asientoId: s.id, precio: zonasMap[s.zonaId]?.precio || 0 }))
        };
        if (couponCode && appliedCoupon) payload.couponCode = couponCode;
        if (holdToken) payload.holdToken = holdToken;

        const res = await reservationsApi.createReservation(payload);
        createdReservationId = res?.reservationId ?? res?.id;
        if (!createdReservationId) {
          throw new Error('No se recibió el identificador de la reservación');
        }
      }
      setReservationId(createdReservationId);
      reservationIdRef.current = createdReservationId;
      bootstrapServiceStatuses(createdReservationId);

      await attachPaymentListener(createdReservationId);

      const paymentResponse = await paymentsApi.createPayment({
        date: new Date().toISOString().slice(0,10),
        amount: amountToCharge,
        state: 'INITIATED',
        reservationId: createdReservationId,
        paymentMethodId: Number(method),
        purpose: 'RESERVATION',
        externalReference: `RES-${createdReservationId}`
      });

      setPaymentId(paymentResponse?.paymentId ?? paymentResponse?.id ?? null);
      setPaymentStatus('approved');
      setPaymentDetail('Pago aprobado automáticamente. Tu reservación quedó confirmada.');
      clearHoldCache();
      setWaitingNotification(false);
      setTimeout(() => {
        navigate('/perfil', { state: { highlightReservation: createdReservationId } });
      }, 1500);
    } catch (err: any) {
      console.error('Pago/Reserva falló', err);
      setPaymentStatus('error');
      if (err?.message && err.message.includes('403')) {
        setPaymentDetail('No autorizado para crear la reservación. Inicia sesión con un cliente.');
      } else if (err === 'SESSION_EXPIRED') {
        setPaymentDetail('Tu sesión expiró. Vuelve a iniciar sesión.');
      } else {
        setPaymentDetail(err?.message || 'Error procesando pago o creando reserva. Inténtalo nuevamente.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return alert('Ingresa un código de cupón');
    try {
      const promos = await eventsApi.getPromotions();
      const matched = (promos || []).find((p: any) => (p.Code ?? p.code)?.toString().toLowerCase() === couponCode.toLowerCase() && Number(p.EventId ?? p.eventId) === Number(evento.id));
      if (!matched) return alert('Cupón no válido para este evento');
      // Validate dates
      const today = new Date();
      const start = matched.StartDate ? new Date(matched.StartDate) : (matched.startDate ? new Date(matched.startDate) : null);
      const end = matched.EndDate ? new Date(matched.EndDate) : (matched.endDate ? new Date(matched.endDate) : null);
      if ((start && today < start) || (end && today > end)) return alert('Cupón no está en vigencia');
      const pct = Number(matched.Percentage ?? matched.percentage ?? 0);
      const discountBase = effectiveSubtotal + servicesTotal;
      const discount = Math.round((discountBase * pct / 100) * 100) / 100;
      setAppliedCoupon(matched);
      setDiscountAmount(discount);
      alert(`Cupón aplicado: ${pct}% => descuento $${discount.toFixed(2)}`);
    } catch (e) {
      console.error('Error aplicando cupón', e);
      alert('Error al validar el cupón');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      {holdToken && (
        <div className="mb-4">
          <div className="bg-red-600 text-white p-4 rounded-lg shadow-md font-bold text-center">
            <div>{t('payment.hold', { time: `${Math.floor((holdRemaining ?? 0)/60)}:${String((holdRemaining ?? 0)%60).padStart(2,'0')}` })}</div>
            {holdRemaining !== null ? (
              <div className="mt-3 flex items-center justify-center gap-3">
                <div className="bg-black text-white px-3 py-1 rounded font-mono text-lg" aria-live="polite" aria-atomic="true">{Math.floor(holdRemaining/60).toString().padStart(2,'0')}</div>
                <div className="text-white text-lg">:</div>
                <div className="bg-black text-white px-3 py-1 rounded font-mono text-lg" aria-live="polite" aria-atomic="true">{(holdRemaining%60).toString().padStart(2,'0')}</div>
              </div>
            ) : (
              <div className="mt-2 text-sm">Tiempo de retención desconocido</div>
            )}
          </div>
        </div>
      )}
      <h1 className="text-3xl font-bold mb-4">Pasarela de Pago (simulada)</h1>
      <div className="bg-base-200 p-4 rounded mb-4">
        <h2 className="font-semibold">Evento</h2>
        <div className="text-lg">{evento?.nombre ?? existingReservation?.evento?.nombre ?? 'Pago de reservación'}</div>
        <div className="text-sm text-gray-400">{evento ? formatEventLocal(evento.fecha, evento.hora) : null}</div>
      </div>

      <div className="bg-base-200 p-4 rounded mb-4">
        <h2 className="font-semibold">Resumen</h2>
        <div className="py-2">
          {seatsForSummary.length > 0 ? (
            seatsForSummary.map((s: any, idx: number) => (
              <div key={s.id ?? idx} className="flex justify-between py-1">
                <div>
                  {s.fila && s.numero ? `${s.fila} - ${s.numero}` : `Asiento ${s.asientoId ?? s.id ?? s.rawId ?? ''}`}
                  {zonasMap[s.zonaId]?.nombre ? ` (${zonasMap[s.zonaId]?.nombre})` : ''}
                </div>
                <div>${(zonasMap[s.zonaId]?.precio ?? s.precio ?? 0).toFixed(2)}</div>
              </div>
            ))
          ) : (
            <div className="flex justify-between py-1">
              <div>{isStreamingEvent ? 'Acceso al streaming' : 'Pago de reservación existente'}</div>
              <div>${effectiveSubtotal.toFixed(2)}</div>
            </div>
          )}
        </div>
        <div className="border-t pt-2 mt-2">
          <div className="flex justify-between"><span>Servicios</span><span>${servicesTotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Subtotal</span><span>${effectiveSubtotal.toFixed(2)}</span></div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-green-400"><span>Descuento ({appliedCoupon?.Percentage ?? appliedCoupon?.percentage ?? '0'}%)</span><span>-${discountAmount.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between font-bold"><span>Total</span><span>${effectiveTotal.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="bg-base-200 p-4 rounded mb-4">
        <h2 className="font-semibold">Cupón</h2>
        <div className="flex gap-2 items-center mb-4">
          <input value={couponCode} onChange={e=>setCouponCode(e.target.value)} placeholder="Código de cupón" className="p-2 bg-base-100 rounded" />
          <Button onClick={handleApplyCoupon} variant="secondary">Aplicar Cupón</Button>
          {appliedCoupon && (
            <div className="ml-4 text-sm text-green-400">Aplicado: {appliedCoupon.Code ?? appliedCoupon.code} — Descuento: ${discountAmount.toFixed(2)}</div>
          )}
        </div>

        <h2 className="font-semibold mb-2">Método de pago</h2>
        {paymentMethods.length === 0 && (
          <div className="text-sm text-gray-400">No hay métodos de pago configurados.</div>
        )}
        {paymentMethods.map((pm) => (
          <label key={pm.id} className="flex items-center space-x-2 py-1">
            <input
              type="radio"
              name="pm"
              checked={method === String(pm.id)}
              onChange={() => setMethod(String(pm.id))}
            />
            <span className="font-medium">{pm.type}</span>
            <span className="text-xs text-gray-400">{pm.detail}</span>
          </label>
        ))}
      </div>

      <div className="bg-base-200 p-4 rounded mb-4">
        <h2 className="font-semibold">Estado del pago</h2>
        <div className="mt-2 text-lg font-semibold">
          {paymentStatus === 'approved' && <span className="text-green-400">Pago aprobado</span>}
          {paymentStatus === 'pending' && <span className="text-yellow-300">Pago en proceso...</span>}
          {paymentStatus === 'creating' && <span className="text-sky-300">Preparando pago...</span>}
          {paymentStatus === 'rejected' && <span className="text-red-400">Pago rechazado</span>}
          {paymentStatus === 'error' && <span className="text-red-400">Error iniciando el pago</span>}
          {paymentStatus === 'idle' && <span className="text-gray-400">Sin intentos aún</span>}
        </div>
        {paymentDetail && <p className="text-sm text-gray-300 mt-2">{paymentDetail}</p>}
        {waitingNotification && (
          <p className="text-xs text-yellow-200 mt-2">Esperando confirmación en tiempo real...</p>
        )}
        <div className="text-xs text-gray-400 mt-3 space-y-1">
          {reservationId && <div>Reservación #{reservationId}</div>}
          {paymentId && <div>Pago #{paymentId}</div>}
        </div>
      </div>

      {serviceStatuses.length > 0 && (
        <div className="bg-base-200 p-4 rounded mb-4">
          <h2 className="font-semibold">Servicios adicionales</h2>
          <p className="text-sm text-gray-400 mt-1">Confirmaremos cada servicio en cuanto el proveedor responda.</p>
          <div className="mt-3 space-y-3">
            {serviceStatuses.map((service) => {
              const normalized = service.status ? service.status.toUpperCase() : 'PENDING';
              const badgeClass = normalized === 'CONFIRMED' ? 'text-green-300 bg-green-500/10' : 'text-yellow-200 bg-yellow-500/10';
              const label = normalized === 'CONFIRMED' ? 'Confirmado' : 'Pendiente';
              return (
                <div key={service.serviceId} className="flex items-center justify-between border border-base-300 rounded-lg px-4 py-3">
                  <div>
                    <div className="font-semibold text-white">{service.name}</div>
                    <div className="text-xs text-gray-400">Servicio #{service.serviceId}</div>
                    <div className="text-sm text-gray-300 mt-1">${Number(service.price ?? 0).toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>{label}</span>
                    {service.updatedAt && (
                      <div className="text-xs text-gray-500 mt-1">Actualizado {new Date(service.updatedAt).toLocaleTimeString()}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-right">
        <Button variant="primary" onClick={handleConfirmPayment} disabled={processing || waitingNotification}>
          {waitingNotification ? 'Esperando confirmación...' : (processing ? 'Procesando...' : 'Confirmar pago')}
        </Button>
      </div>
    </div>
  );
};
