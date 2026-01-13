import React, { useState, useEffect } from 'react';
import type { Reservacion, Evento } from '../../types';
import reservationsApi from '../../services/reservationsApi';
import eventsApi from '../../services/eventsApi';
import paymentsApi from '../../services/paymentsApi';
import { useKeycloak } from '../../hooks/useKeycloak';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { getServiceStatusCache } from '../../services/serviceStatusCache';
import keycloak from '../../services/keycloakService';

type Tab = 'reservaciones' | 'asistidos' | 'pagos' | 'perfil';

interface PopulatedReservacion extends Reservacion {
  evento?: Evento;
}

export const UserProfile = () => {
  const [activeTab, setActiveTab] = useState<Tab>('reservaciones');
  const [reservaciones, setReservaciones] = useState<PopulatedReservacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const { profile } = useKeycloak();
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const [nameDraft, setNameDraft] = useState(profile?.firstName || '');
  const [lastNameDraft, setLastNameDraft] = useState(profile?.lastName || '');
  const [emailDraft, setEmailDraft] = useState(profile?.email || '');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwordCurrent, setPasswordCurrent] = useState('');
  const [passwordNew, setPasswordNew] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const describeServiceStatus = (status?: string) => {
    const normalized = String(status || 'PENDING').toUpperCase();
    if (normalized === 'CONFIRMED') {
      return { label: 'Confirmado', badgeClass: 'bg-green-500/20 text-green-200' };
    }
    if (normalized === 'REJECTED' || normalized === 'FAILED' || normalized === 'CANCELLED') {
      return { label: 'Rechazado', badgeClass: 'bg-red-500/20 text-red-300' };
    }
    if (normalized === 'IN_PROGRESS' || normalized === 'REQUESTED') {
      return { label: 'En proceso', badgeClass: 'bg-sky-500/20 text-sky-200' };
    }
    return { label: 'Pendiente', badgeClass: 'bg-yellow-500/20 text-yellow-200' };
  };
  
  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;
      setLoading(true);
      setPaymentsLoading(true);
      setPaymentsError(null);
      try {
        const [reservacionesData, eventosData, pagosData] = await Promise.all([
          // fetch reservations from Reservations-service
          reservationsApi.getReservations(profile.id),
          // fetch events from Events-service
          eventsApi.getEvents(),
          // fetch payments from Payments-service
          paymentsApi.getUserPayments(profile.id).catch(err => {
            console.error('Error fetching payments', err);
            setPaymentsError('No se pudieron cargar tus pagos.');
            return [];
          })
        ]);
        setPayments(pagosData || []);
        setPaymentsLoading(false);
        
        const eventosMap = new Map(eventosData.map(e => [e.id, e]));

        // Prefer server reservations, then include any local-only reservations (deduped by id)
        const serverPopulated = reservacionesData.map((res: any) => ({ ...res, evento: eventosMap.get(res.eventoId) }));
        const mapById = new Map<string, any>();
        serverPopulated.forEach((r: any) => mapById.set(String(r.id), r));

        // merge local reservations created by the mock payment flow, only if not present on server
        try {
          const localKey = 'local_reservaciones';
          const local = JSON.parse(localStorage.getItem(localKey) || '[]') as any[];
          const forUser = local.filter(r => r.usuarioId === profile.id || r.usuarioEmail === profile.email);
          forUser.forEach(r => {
            const key = String(r.id ?? r.reservationId ?? `${r.eventoId}:${r.fecha}`);
            if (!mapById.has(key)) {
              mapById.set(key, { ...r, evento: eventosMap.get(r.eventoId) });
            }
          });
        } catch (e) {
          // ignore
        }

        // Before setting reservations, enrich seat info using Events API so we can show human-readable seat labels
        const reservationsList: any[] = Array.from(mapById.values());

        // collect unique stageIds from events referenced by reservations
        const stageIds = Array.from(new Set(reservationsList.map(r => r.evento?.stageId).filter((x: any) => !!x)));
        const seatsByStage: Record<number, { seatMap: Record<string, any>, zonas: any[] }> = {};

        await Promise.all(stageIds.map(async (stageId: number) => {
          try {
            const got = await eventsApi.getSeats(stageId);
            // got = { seats, zonas }
            const seatMap: Record<string, any> = {};
            const zonas = got.zonas || [];
            (got.seats || []).forEach((s: any) => {
              // rawId should be numeric id from DB
              const key = String(s.rawId ?? s.id ?? s.rawId);
              const zonaInfo = zonas.find((z: any) => z.id === s.zonaId) || { nombre: s.zonaId ? String(s.zonaId) : 'General', precio: null };
              seatMap[key] = { zona: zonaInfo.nombre, fila: s.fila, numero: s.numero, precio: zonaInfo.precio };
            });
            seatsByStage[stageId] = { seatMap, zonas };
          } catch (e) {
            console.warn('Could not fetch seats for stage', stageId, e);
          }
        }));

        // attach human-readable seat labels to each reservation
        reservationsList.forEach((r: any) => {
          r._seatsDetailed = (r.seats || []).map((s: any) => {
            const asientoId = String(s.asientoId ?? s.asientoId ?? s.id ?? s.rawId ?? s.asientoRawId ?? '');
            const stageId = r.evento?.stageId;
            if (stageId && seatsByStage[stageId] && seatsByStage[stageId].seatMap[asientoId]) {
              const info = seatsByStage[stageId].seatMap[asientoId];
              return { label: `${info.zona} — ${info.fila}-${info.numero}`, precio: s.precio ?? info.precio ?? 0 };
            }
            // fallback: try to use asientoId and precio
            return { label: `Asiento ${asientoId}`, precio: s.precio ?? 0 };
          });
        });

        const cachedStatuses = getServiceStatusCache();
        reservationsList.forEach((r: any) => {
          const key = r.id ?? r.reservationId;
          if (!key) return;
          const stored = cachedStatuses[String(key)];
          if (stored && stored.length > 0) {
            r._serviceStatuses = stored;
          }
        });

        setReservaciones(reservationsList);

      } catch (error) {
        console.error("Error fetching user data:", error);
        setPaymentsLoading(false);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile]);

  const renderContent = () => {
    if(loading) return <div className="text-center p-8">Cargando tus datos...</div>;
    // compute precise event DateTime using `fecha` (DateOnly) and optional `hora` returned by Events API
    const eventDateTime = (evt?: any) => {
      if (!evt || !evt.fecha) return new Date(0);
      const date = String(evt.fecha);
      const time = evt.hora ?? evt.time ?? null;
      try {
        if (time) {
          // prefer ISO-like "YYYY-MM-DDTHH:mm[:ss]" when time is simple HH:mm or HH:mm:ss
          if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) {
            return new Date(`${date}T${time}`);
          }
          // fall back to parsing "YYYY-MM-DD HH:mm AM/PM" or other locale variants
          return new Date(`${date} ${time}`);
        }
        // no time provided -> treat event as happening at end of day to include same-day events
        return new Date(`${date}T23:59:59`);
      } catch (e) {
        return new Date(date);
      }
    };

    switch (activeTab) {
      case 'perfil':
        return (
          <div className="max-w-xl space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Mi información</h2>
              <p className="text-sm text-gray-400">Actualiza tu perfil y cambia tu contraseña directamente en Keycloak.</p>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm text-gray-400">Nombre</span>
                <input className="input input-bordered w-full bg-base-200"
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  placeholder="Nombre"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-400">Apellidos</span>
                <input className="input input-bordered w-full bg-base-200"
                  value={lastNameDraft}
                  onChange={e => setLastNameDraft(e.target.value)}
                  placeholder="Apellidos"
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-400">Correo</span>
                <input className="input input-bordered w-full bg-base-200"
                  type="email"
                  value={emailDraft}
                  onChange={e => setEmailDraft(e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </label>
              <Button
                variant="primary"
                disabled={savingProfile || !profile}
                onClick={async () => {
                  if (!profile) return;
                  setSavingProfile(true);
                  try {
                    const baseUrl = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080';
                    const realm = import.meta.env.VITE_KEYCLOAK_REALM || 'ds-repo1';
                    const token = await keycloak.ensureTokenValid(30).then(() => keycloak.getToken()).catch(() => null);
                    if (!token) throw new Error('No se pudo obtener token');
                    await fetch(`${baseUrl}/realms/${realm}/account`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({
                        firstName: nameDraft,
                        lastName: lastNameDraft,
                        email: emailDraft,
                        attributes: profile?.attributes ?? {}
                      })
                    });
                    alert('Perfil actualizado.');
                  } catch (err) {
                    console.error('No se pudo actualizar perfil', err);
                    alert('No se pudo actualizar perfil. Revisa conexión o permisos.');
                  } finally {
                    setSavingProfile(false);
                  }
                }}
              >
                {savingProfile ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>

            <div className="space-y-3 pt-2 border-t border-base-300">
              <h3 className="text-lg font-semibold text-white">Cambiar contraseña</h3>
              <label className="block">
                <span className="text-sm text-gray-400">Contraseña actual</span>
                <input className="input input-bordered w-full bg-base-200"
                  type="password"
                  value={passwordCurrent}
                  onChange={e => setPasswordCurrent(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-400">Nueva contraseña</span>
                <input className="input input-bordered w-full bg-base-200"
                  type="password"
                  value={passwordNew}
                  onChange={e => setPasswordNew(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-400">Confirmar nueva contraseña</span>
                <input className="input input-bordered w-full bg-base-200"
                  type="password"
                  value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                />
              </label>
              <Button
                variant="secondary"
                disabled={savingProfile || !profile || !passwordCurrent || !passwordNew || passwordNew !== passwordConfirm}
                onClick={async () => {
                  if (!profile) return;
                  setSavingProfile(true);
                  try {
                    const baseUrl = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080';
                    const realm = import.meta.env.VITE_KEYCLOAK_REALM || 'ds-repo1';
                    const token = await keycloak.ensureTokenValid(30).then(() => keycloak.getToken()).catch(() => null);
                    if (!token) throw new Error('No se pudo obtener token');
                    await fetch(`${baseUrl}/realms/${realm}/account/credentials/password`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({
                        currentPassword: passwordCurrent,
                        newPassword: passwordNew,
                        confirmation: passwordConfirm
                      })
                    });
                    alert('Contraseña actualizada. Vuelve a iniciar sesión.');
                    setPasswordCurrent('');
                    setPasswordNew('');
                    setPasswordConfirm('');
                  } catch (err) {
                    console.error('No se pudo cambiar la contraseña', err);
                    alert('No se pudo cambiar la contraseña. Verifica la actual y permisos.');
                  } finally {
                    setSavingProfile(false);
                  }
                }}
              >
                {savingProfile ? 'Actualizando...' : 'Cambiar contraseña'}
              </Button>
            </div>
          </div>
        );
      case 'reservaciones':
        const activas = reservaciones.filter(r => eventDateTime(r.evento) >= new Date());
        const toggleExpanded = (id: string | number) => setExpandedIds(prev => ({ ...prev, [String(id)]: !prev[String(id)] }));

        const deriveReservationStatus = (res: any) => {
          const resId = res.id ?? res.reservationId;
          const paymentsForRes = payments.filter(p => String(p.reservationId ?? p.ReservationId ?? p.reservationID ?? '') === String(resId));
          const hasApproved = paymentsForRes.some(p => String(p.state ?? p.State ?? '').toLowerCase() === 'approved');
          const hasPending = paymentsForRes.some(p => String(p.state ?? p.State ?? '').toLowerCase() === 'pending' || String(p.state ?? '').toLowerCase() === 'initiated');
          if (hasApproved) return { label: 'Confirmada', className: 'bg-green-500/20 text-green-300', isPaid: true };
          if (hasPending) return { label: 'Pendiente de pago', className: 'bg-yellow-500/20 text-yellow-300', isPaid: false };
          const st = String(res.estado || res.state || '').toLowerCase();
          const isPaid = st === 'paid' || st === 'confirmada';
          const label = isPaid ? 'Confirmada' : (res.estado || 'Pendiente');
          return { label, className: isPaid ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300', isPaid };
        };

        return activas.length > 0 ? (
          <div className="space-y-4">
            {activas.map(res => {
              const serviceStatuses = (res as any)._serviceStatuses as any[] | undefined;
              const derived = deriveReservationStatus(res);
              const canPay = !derived.isPaid;
              return (
                <div key={res.id} className="bg-base-300 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg text-white">{res.evento?.nombre || 'Evento Desconocido'}</h3>
                      <p className="text-sm text-gray-400">Fecha de compra: {new Date(res.fecha).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-400">Total: ${Number(res.total || 0).toFixed(2)}</p>
                      <p className="text-sm text-gray-400">Entradas: {((res._seatsDetailed && res._seatsDetailed.length>0)
                        ? res._seatsDetailed.map((s:any)=>s.label).join(', ')
                        : (res.seats && res.seats.length>0) ? res.seats.map((s:any)=>String(s.asientoId)).join(', ') : '—')}
                      </p>
                      {res.couponCode && (
                        <p className="text-sm text-green-300">Cupón: <span className="font-semibold">{res.couponCode}</span> — Descuento: ${Number(res.discountAmount ?? 0).toFixed(2)}</p>
                      )}
                      {serviceStatuses && serviceStatuses.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {serviceStatuses.map((service, idx) => {
                            const numericId = Number(service.serviceId ?? service.id ?? service.Id ?? 0);
                            const fallbackId = numericId > 0 ? numericId : idx + 1;
                            const name = service.name || `Servicio #${fallbackId}`;
                            const { label, badgeClass } = describeServiceStatus(service.status);
                            return (
                              <span key={`${res.id}-${fallbackId}`} className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
                                {name}: {label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${derived.className}`}>
                        {derived.label}
                      </span>

                      <div className="flex items-center gap-2">
                        {canPay && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => navigate('/payment', {
                              state: {
                                existingReservation: res,
                                evento: res.evento,
                                zonasMap: {},
                                selectedSeats: res.seats ?? [],
                                subtotal: res.total ?? 0,
                                servicesTotal: 0,
                                total: res.total ?? 0,
                              }
                            })}
                          >
                            Pagar ahora
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => toggleExpanded(res.id)}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span className="text-sm">{expandedIds[String(res.id)] ? 'Ocultar' : 'Detalles'}</span>
                        </Button>

                        <Link to={`/evento/${res.eventoId}`}>
                          <Button size="sm" variant="secondary">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                            <span className="text-sm">Ver Evento</span>
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {expandedIds[String(res.id)] && (
                    <div className="mt-4 border-t pt-4 text-sm text-gray-300">
                      <h4 className="font-semibold">Información del evento</h4>
                      <p>{res.evento?.nombre}</p>
                      <p className="text-gray-400">{res.evento?.descripcion}</p>

                      <div className="mt-3">
                        <h4 className="font-semibold">Servicios</h4>
                        {serviceStatuses && serviceStatuses.length > 0 ? (
                          <div className="space-y-3 mt-2">
                            {serviceStatuses.map((service, idx) => {
                              const numericId = Number(service.serviceId ?? service.id ?? service.Id ?? 0);
                              const fallbackId = numericId > 0 ? numericId : idx + 1;
                              const { label, badgeClass } = describeServiceStatus(service.status);
                              const name = service.name || `Servicio #${fallbackId}`;
                              return (
                                <div key={`${res.id}-detail-${fallbackId}`} className="flex items-center justify-between border border-base-300 rounded-lg px-3 py-2">
                                  <div>
                                    <p className="font-semibold text-white">{name}</p>
                                    <p className="text-xs text-gray-400">Servicio #{fallbackId} — ${Number(service.price ?? 0).toFixed(2)}</p>
                                  </div>
                                  <div className="text-right">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>{label}</span>
                                    {service.updatedAt && (
                                      <div className="text-[10px] text-gray-500 mt-1">Actualizado {new Date(service.updatedAt).toLocaleString()}</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : res.services && res.services.length > 0 ? (
                          <ul className="list-disc pl-5">
                            {res.services.map((s: any) => <li key={s.id}>{s.name} — ${Number(s.price).toFixed(2)}</li>)}
                          </ul>
                        ) : <p className="text-gray-400">No se solicitaron servicios adicionales.</p>}
                      </div>

                      <div className="mt-3">
                        <h4 className="font-semibold">Asientos</h4>
                        {res._seatsDetailed && res._seatsDetailed.length > 0 ? (
                          <ul className="list-disc pl-5">
                            {res._seatsDetailed.map((s: any, idx: number) => (
                              <li key={idx}>{s.label} — ${Number(s.precio ?? 0).toFixed(2)}</li>
                            ))}
                          </ul>
                        ) : res.seats && res.seats.length > 0 ? (
                          // fallback to raw format if enrichment failed
                          <ul className="list-disc pl-5">
                            {res.seats.map((s: any, idx: number) => <li key={idx}>{s.asientoId} — ${Number(s.precio).toFixed(2)}</li>)}
                          </ul>
                        ) : <p className="text-gray-400">No hay asientos registrados para esta reservación.</p>}
                      </div>

                      {res.couponCode && (
                        <div className="mt-4">
                          <h4 className="font-semibold">Cupón aplicado</h4>
                          <p className="text-sm">Código: <span className="font-medium">{res.couponCode}</span></p>
                          <p className="text-sm">Descuento: <span className="font-medium">${Number(res.discountAmount ?? 0).toFixed(2)}</span></p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : <p className="text-gray-400">No tienes reservaciones para eventos futuros.</p>;
        case 'asistidos':
          const pasadas = reservaciones.filter(r => eventDateTime(r.evento) < new Date());
          return pasadas.length > 0 ? (
             <div className="space-y-4">
                {pasadas.map(res => (
                   <div key={res.id} className="bg-base-300 p-4 rounded-lg opacity-70 flex justify-between items-center">
                        <h3 className="font-bold text-lg">{res.evento?.nombre || 'Evento Desconocido'}</h3>
                        <span className="text-sm text-gray-500">Evento finalizado</span>
                   </div>
                ))}
            </div>
          ) : <p className="text-gray-400">Aún no has asistido a ningún evento.</p>;
      case 'pagos':
        if (paymentsLoading) return <div className="text-center p-4 text-gray-300">Cargando tus pagos...</div>;
        if (paymentsError) return <div className="text-center p-4 text-red-300">{paymentsError}</div>;
        if (!payments || payments.length === 0) return <p className="text-gray-400">Aún no tienes pagos registrados.</p>;

        const stateBadge = (state: string) => {
          const normalized = (state || '').toLowerCase();
          if (['approved', 'paid', 'confirmado', 'confirmada'].includes(normalized)) return { label: 'Aprobado', className: 'bg-green-500/20 text-green-200' };
          if (['rejected', 'failed', 'cancelled', 'canceled'].includes(normalized)) return { label: 'Rechazado', className: 'bg-red-500/20 text-red-300' };
          return { label: 'Pendiente', className: 'bg-yellow-500/20 text-yellow-200' };
        };

        return (
          <div className="space-y-3">
            {payments.map((p: any) => {
              const id = p.id ?? p.paymentId ?? p.PaymentId ?? p.PaymentID ?? '—';
              const amount = Number(p.amount ?? p.Amount ?? 0);
              const state = p.state ?? p.State ?? p.status ?? p.Status ?? 'PENDIENTE';
              const date = p.date ?? p.Date ?? p.createdAt ?? p.CreatedAt ?? null;
              const reservationId = p.reservationId ?? p.ReservationId ?? p.reservationID ?? null;
              const purpose = p.purpose ?? p.Purpose ?? '';
              const badge = stateBadge(state);
              const reservationMatch = reservationId
                ? reservaciones.find(r => String(r.id ?? r.reservationId) === String(reservationId))
                : null;
              const eventName = reservationMatch?.evento?.nombre;
              const invoiceUrl = p.invoiceUrl ?? p.InvoiceUrl ?? p.pdfUrl ?? null;
              return (
                <div key={id} className="bg-base-300 p-4 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm text-gray-400">Pago #{id}</div>
                    <div className="text-lg font-semibold text-white">${amount.toFixed(2)}</div>
                    <div className="text-sm text-gray-300 flex gap-2 flex-wrap">
                      <span>{date ? new Date(date).toLocaleString() : 'Fecha no disponible'}</span>
                      {purpose && <span className="text-gray-400">• {purpose}</span>}
                      {reservationId && <span className="text-gray-400">• Reserva #{reservationId}</span>}
                      {eventName && <span className="text-gray-300">• {eventName}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                    {invoiceUrl && (
                      <a
                        href={invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-outline"
                      >
                        Descargar factura
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      default:
        return null;
    }
  };

  const TabButton = ({ tabId, label }: { tabId: Tab; label:string }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors focus:outline-none ${
        activeTab === tabId
          ? 'bg-base-200 text-primary border-b-2 border-primary'
          : 'text-gray-400 hover:text-white hover:bg-base-300/50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-6 text-white">Mi Perfil</h1>
      <div className="w-full">
        <div className="border-b border-gray-700">
          <nav className="-mb-px flex space-x-2" aria-label="Tabs">
            <TabButton tabId="reservaciones" label="Mis Reservaciones" />
            <TabButton tabId="asistidos" label="Mis Eventos Asistidos" />
            <TabButton tabId="pagos" label="Mis Pagos" />
          </nav>
        </div>
        <div className="py-6 bg-base-200 p-6 rounded-b-lg min-h-[20rem]">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
