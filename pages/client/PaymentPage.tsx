import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import reservationsApi from '../../services/reservationsApi';
import eventsApi from '../../services/eventsApi';
import { useKeycloak } from '../../hooks/useKeycloak';
import api from '../../services/api';
import { Button } from '../../components/ui/Button';

export const PaymentPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state || {}) as any;
  const { selectedSeats = [], evento, zonasMap = {}, selectedServiceIds = [], subtotal = 0, servicesTotal = 0, total = 0 } = state;
  const { holdToken, holdExpires } = state as any;
  const { profile } = useKeycloak();

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

  const [method, setMethod] = React.useState<string>('card');
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

  if (!evento || selectedSeats.length === 0) {
    return (
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold">No hay nada que pagar</h1>
        <Button onClick={() => navigate('/')}>Volver al inicio</Button>
      </div>
    );
  }

  const handleConfirmPayment = async () => {
    setProcessing(true);
    try {
      // Simulate payment delay
      await new Promise(r => setTimeout(r, 1000));

      // Create reservation in backend as 'paid'
      const payload: any = {
        date: new Date().toISOString().slice(0,10),
        state: 'paid',
        eventoId: evento.id,
        total: (total - discountAmount),
        additionalServiceIds: selectedServiceIds,
        seats: selectedSeats.map((s: any) => ({ asientoId: s.id, precio: zonasMap[s.zonaId]?.precio || 0 }))
      };
      if (couponCode && appliedCoupon) payload.couponCode = couponCode;
      if (holdToken) payload.holdToken = holdToken;

      const res = await reservationsApi.createReservation(payload);

      // clear any local hold for this event
      const eventId = evento.id;
      try {
        sessionStorage.removeItem(`seat_hold_expiry_${eventId}`);
        sessionStorage.removeItem(`seat_hold_selected_${eventId}`);
      } catch { }

      const reservationId = res?.reservationId ?? res?.id ?? null;

      // Persist a local copy only if server didn't return an id (offline fallback)
      if (!reservationId) {
        try {
          const localKey = 'local_reservaciones';
          const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
          const localRes = {
            id: Math.floor(Date.now()/1000),
            usuarioId: profile?.id ?? 'unknown',
            usuarioEmail: profile?.email ?? '',
            eventoId: evento.id,
            estado: 'CONFIRMADA',
            total: total,
            fecha: new Date().toISOString()
          };
          existing.push(localRes);
          localStorage.setItem(localKey, JSON.stringify(existing));

          // also save details
          const detailKey = 'local_reservaciones_detalle';
          const existingDetails = JSON.parse(localStorage.getItem(detailKey) || '[]');
          const seatDetails = selectedSeats.map((s: any, idx: number) => ({ id: `${localRes.id}-${idx}`, reservacionId: localRes.id, asientoId: s.id, precio: zonasMap[s.zonaId]?.precio || 0 }));
          localStorage.setItem(detailKey, JSON.stringify(existingDetails.concat(seatDetails)));
        } catch (e) {
          console.warn('Failed to persist local reservation', e);
        }
      }

      alert('Pago simulado exitoso. Reservación creada. ID: ' + reservationId);
      navigate('/perfil');
    } catch (err: any) {
      console.error('Pago/Reserva falló', err);
      // Provide clearer message when backend returns 403 (forbidden) because of missing role
      if (err?.message && err.message.includes('403')) {
        alert('No autorizado para crear la reservación. Asegúrate de haber iniciado sesión con una cuenta de cliente (rol cliente).');
      } else if (err === 'SESSION_EXPIRED') {
        alert('Tu sesión expiró. Vuelve a iniciar sesión.');
      } else {
        alert('Error procesando pago o creando reserva. Intentalo de nuevo');
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
      const discount = Math.round(((total) * pct / 100) * 100) / 100;
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
            <div>Tienes asientos reservados temporalmente. Finaliza el pago antes de que caduque.</div>
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
        <div className="text-lg">{evento.nombre}</div>
  <div className="text-sm text-gray-400">{formatEventLocal(evento.fecha, evento.hora)}</div>
      </div>

      <div className="bg-base-200 p-4 rounded mb-4">
        <h2 className="font-semibold">Resumen</h2>
        <div className="py-2">
          {selectedSeats.map((s: any) => (
            <div key={s.id} className="flex justify-between py-1">
              <div>{s.fila} - {s.numero} ({zonasMap[s.zonaId]?.nombre})</div>
              <div>${(zonasMap[s.zonaId]?.precio || 0).toFixed(2)}</div>
            </div>
          ))}
        </div>
        <div className="border-t pt-2 mt-2">
          <div className="flex justify-between"><span>Servicios</span><span>${servicesTotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-green-400"><span>Descuento ({appliedCoupon?.Percentage ?? appliedCoupon?.percentage ?? '0'}%)</span><span>-${discountAmount.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between font-bold"><span>Total</span><span>${(total - discountAmount).toFixed(2)}</span></div>
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
        <label className="flex items-center space-x-2"><input type="radio" name="pm" checked={method==='card'} onChange={() => setMethod('card')} /> <span>Tarjeta de crédito / débito</span></label>
        <label className="flex items-center space-x-2"><input type="radio" name="pm" checked={method==='paypal'} onChange={() => setMethod('paypal')} /> <span>PayPal</span></label>
        <label className="flex items-center space-x-2"><input type="radio" name="pm" checked={method==='oxxo'} onChange={() => setMethod('oxxo')} /> <span>Pago en OXXO (simulado)</span></label>
      </div>

      <div className="text-right">
        <Button variant="primary" onClick={handleConfirmPayment} disabled={processing}>{processing ? 'Procesando...' : 'Confirmar Pago'}</Button>
      </div>
    </div>
  );
};
