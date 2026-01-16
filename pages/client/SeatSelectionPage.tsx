import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import eventsApi from '../../services/eventsApi';
import reservationsApi from '../../services/reservationsApi';
import { joinEventChannel, leaveEventChannel, registerSeatUpdateHandler, registerSeatHoldCreatedHandler, registerSeatHoldReleasedHandler, registerSeatHoldExpiredHandler, type SeatUpdatePayload, type SeatHoldPayload } from '../../services/notificationHubClient';
// FIX: Import the Escenario type.
import type { Evento, Asiento, Zona, Escenario } from '../../types';
import { Button } from '../../components/ui/Button';
import { useI18n } from '../../i18n';

export const SeatSelectionPage = () => {
  const { id: eventoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [asientos, setAsientos] = useState<Asiento[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Asiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [holdExpires, setHoldExpires] = useState<string | null>(null);
  const [holdToken, setHoldToken] = useState<string | null>(null);
  const [holdRemaining, setHoldRemaining] = useState<number>(0);
  const [holdExpiresIso, setHoldExpiresIso] = useState<string | null>(null);
  // Nuevo: seatIds del hold actual
  const [holdSeatIds, setHoldSeatIds] = useState<string[]>([]);
  const [updatingHold, setUpdatingHold] = useState(false);
  const [stageId, setStageId] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [reservedSeatIds, setReservedSeatIds] = useState<Set<string>>(new Set());

  // Ref with current seats snapshot to avoid relying on async setState when reconciling holds
  const seatsRef = useRef<Asiento[]>([]);
  // Pending hold tracker (sorted string ids) set when a hold POST is in-flight
  const pendingHoldRef = useRef<{ seatIds: string[] } | null>(null);

  // Keep seatsRef in sync with latest seats state synchronously
  useEffect(() => { seatsRef.current = asientos; }, [asientos]);

  useEffect(() => {
    const fetchData = async () => {
      if (!eventoId) return;
      console.log('[SeatSelection] fetchData start', { eventoId });
      setLoading(true);
      try {
        const eventDto = await eventsApi.getEvent(Number(eventoId));
        console.log('[SeatSelection] event loaded', { eventDto });
        setEvento(eventDto);
        const eventFormat = (eventDto as any).eventFormat ?? 'presencial';
        if (eventFormat === 'streaming') {
          const streamingPrice = Number((eventDto as any).generalPrice ?? 0) || 0;
          // Redirigir directamente a pago para eventos de streaming (sin asientos)
          navigate('/payment', {
            replace: true,
            state: {
              selectedSeats: [],
              evento: eventDto,
              zonasMap: {},
              selectedServiceIds: [],
              selectedServices: [],
              subtotal: streamingPrice,
              servicesTotal: 0,
              total: streamingPrice,
              streamingPrice,
            },
          });
          return;
        }
        const stage = eventDto.stageId;
        setStageId(stage ?? null);
        if (stage) {
          const { seats: mappedSeats, zonas: mappedZonas } = await eventsApi.getSeats(stage);
          console.log('[SeatSelection] seats loaded by stage', { stage, count: mappedSeats?.length });
          setAsientos(mappedSeats);
          setZonas(mappedZonas);
          try { console.debug('SeatSelection: fetched seats', { stageId: stage, seats: mappedSeats, zonas: mappedZonas }); } catch {}
        } else {
          // Sin stageId no cargamos asientos para evitar mezclar eventos
          setAsientos([]);
          setZonas([]);
        }
  // fetch reservations for this event and mark seats occupied
        try {
          const allRes = await reservationsApi.getReservations();
          const forEvent = (allRes || []).filter((r: any) => Number(r.eventoId) === Number(eventoId));
          console.log('[SeatSelection] reservations fetched', { total: allRes?.length, forEvent: forEvent?.length });
          const reservedSeatIds = new Set<string>();
          forEvent.forEach((r: any) => {
            if (r.seats && Array.isArray(r.seats)) {
              r.seats.forEach((s: any) => {
                if (s.asientoId) reservedSeatIds.add(s.asientoId);
              });
            }
          });
          setReservedSeatIds(reservedSeatIds);
          if (reservedSeatIds.size > 0) {
            console.log('[SeatSelection] mark reserved seats as occupied', { reservedCount: reservedSeatIds.size });
            setAsientos(prev => prev.map(a => ({ ...a, estado: reservedSeatIds.has(a.id) ? 'ocupado' : a.estado })));
          }
        } catch (e) {
          // ignore reservation fetch errors
          console.warn('[SeatSelection] reservations fetch failed', e);
        }

        // hydrate existing hold from sessionStorage (if any)
        try {
          const token = sessionStorage.getItem(`hold_token_${eventoId}`);
          const expires = sessionStorage.getItem(`hold_expires_${eventoId}`);
          if (token && expires) {
            setHoldToken(token);
            setHoldExpires(expires);
            setHoldExpiresIso(expires);
          }
        } catch {}
      } catch (error) {
        console.error("Error fetching seat data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventoId, stageId]);

  // Real-time updates via NotificationHub (SeatsReserved/Released/Sold)
  useEffect(() => {
    if (!eventoId) return;
    const eventNumeric = Number(eventoId);
    if (Number.isNaN(eventNumeric)) return;

    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    const cleanupFns: Array<() => void> = [];

    const applySeatStatus = (seatCode: string, status: string) => {
      const normalized = status.toUpperCase();
      setAsientos(prev => prev.map(seat => {
        if (String(seat.id) !== seatCode) return seat;
        if (normalized === 'RESERVED') return { ...seat, estado: 'hold' };
        if (normalized === 'RELEASED') return { ...seat, estado: 'disponible' };
        if (normalized === 'SOLD') return { ...seat, estado: 'ocupado' };
        return seat;
      }));

      if (normalized === 'RESERVED' || normalized === 'SOLD') {
        setSelectedSeats(prev => {
          const filtered = prev.filter(s => String(s.id) !== seatCode);
          if (filtered.length !== prev.length) {
            alert('Algunos asientos fueron tomados por otro usuario. Actualizamos tu selección.');
          }
          return filtered;
        });
      }
    };

    (async () => {
      try {
        await joinEventChannel(eventNumeric);
        console.log('[SeatSelection] joined event channel', { eventNumeric });
        unsubscribe = await registerSeatUpdateHandler((payload: SeatUpdatePayload) => {
          if (!mounted || !payload) return;
          const payloadEventId = Number(payload.eventId ?? (payload as any).EventId ?? 0);
          if (payloadEventId !== eventNumeric) return;
          const seatCode = String(payload.seatCode ?? (payload as any).SeatCode ?? '');
          if (!seatCode) return;
          const status = String(payload.status ?? (payload as any).Status ?? 'UNKNOWN');
          console.log('[SeatSelection] ReceiveSeatUpdate', { payload });
          applySeatStatus(seatCode, status);
        });

        const onHoldCreated = async (payload: SeatHoldPayload) => {
          if (!mounted || !payload) return;
          const evId = Number(payload.eventoId ?? (payload as any).eventoId ?? 0);
          if (evId !== eventNumeric) return;
          console.log('[SeatSelection] SeatHoldCreated', { payload, myToken: holdToken });
          const seatsPayload = payload.seats ?? (payload as any).Seats ?? [];
          const tokenFromPayload = payload.token ?? (payload as any).token ?? '';
          const seatIdsFromPayload = seatsPayload
            .map((s: any) => String(s.asientoId ?? s.AsientoId ?? s.id ?? ''))
            .filter(Boolean)
            .sort();

          const pending = pendingHoldRef.current;
          const matchesPending = pending && pending.seatIds.length === seatIdsFromPayload.length &&
            pending.seatIds.every((id, idx) => id === seatIdsFromPayload[idx]);
          if (tokenFromPayload && (holdToken === tokenFromPayload || matchesPending)) {
            const expiresAtIso = payload.expiresAt ?? (payload as any).expiresAt ?? null;
            if (expiresAtIso) {
              const expires = new Date(expiresAtIso).toISOString();
              setHoldToken(tokenFromPayload);
              setHoldExpires(expiresAtIso);
              setHoldExpiresIso(expires);
              setHoldRemaining(Math.max(0, Math.floor((new Date(expires).getTime() - Date.now()) / 1000)));
              try {
                sessionStorage.setItem(`hold_token_${eventoId}`, tokenFromPayload);
                sessionStorage.setItem(`hold_expires_${eventoId}`, expires);
              } catch {}
            }
            // asegurar que los asientos queden en selección local y con estado hold
            if (seatIdsFromPayload.length > 0) {
              setAsientos(prev => prev.map(seat => {
                if (seatIdsFromPayload.includes(String(seat.id))) {
                  return { ...seat, estado: 'hold' as const };
                }
                return seat;
              }));
              const byId = new Map<string, Asiento>();
              seatsRef.current.forEach(s => byId.set(String(s.id), s));
              const chosen = seatIdsFromPayload
                .map(id => byId.get(id))
                .filter(Boolean) as Asiento[];
              if (chosen.length > 0) {
                setSelectedSeats(chosen);
                setHoldSeatIds(seatIdsFromPayload); // Actualizar seatIds del hold actual
              }
            }
            pendingHoldRef.current = null;
            return;
          }

          try {
            if (seatsPayload.length > 0) {
              const ids = seatIdsFromPayload;
              if (ids.length > 0) {
                setAsientos(prev => prev.map(seat => {
                  if (ids.includes(String(seat.id))) {
                    return { ...seat, estado: 'ocupado' as const };
                  }
                  return seat;
                }));
                setSelectedSeats(prev => prev.filter(s => !ids.includes(String(s.id))));
              }
            }
            if (!stageId) return;
            const data = await eventsApi.getSeats(stageId);
            const withReservations = applyReservationOverlay(data.seats || []);
            reconcileSelection(withReservations);
            setAsientos(withReservations);
            setZonas(data.zonas || []);
          } catch (e) {
            console.warn('SeatSelection: could not refresh seats after hold event', e);
          }
        };
        const onHoldReleased = async (payload: SeatHoldPayload) => {
          if (!mounted || !payload) return;
          const evId = Number(payload.eventoId ?? (payload as any).eventoId ?? 0);
          if (evId !== eventNumeric) return;
          console.log('[SeatSelection] SeatHoldReleased', { payload });
          const seatsPayload = payload.seats ?? (payload as any).Seats ?? [];
          if (seatsPayload.length > 0) {
            const ids = seatsPayload.map((s: any) => String(s.asientoId ?? s.AsientoId ?? s.id ?? ''));
            if (ids.length > 0) {
              setAsientos(prev => applyReservationOverlay(prev.map(seat => {
                if (ids.includes(String(seat.id))) {
                  return { ...seat, estado: 'disponible' as const };
                }
                return seat;
              })));
              setSelectedSeats(prev => prev.filter(s => !ids.includes(String(s.id))));
            }
          }
          try {
            if (!stageId) return;
            const data = await eventsApi.getSeats(stageId);
            const withReservations = applyReservationOverlay(data.seats || []);
            reconcileSelection(withReservations);
            setAsientos(withReservations);
            setZonas(data.zonas || []);
          } catch (e) {
            console.warn('SeatSelection: could not refresh seats after hold release', e);
          }
        };
        const onHoldExpired = onHoldReleased;

        const u1 = await registerSeatHoldCreatedHandler(onHoldCreated);
        const u2 = await registerSeatHoldReleasedHandler(onHoldReleased);
        const u3 = await registerSeatHoldExpiredHandler(onHoldExpired);
        [u1, u2, u3].forEach(u => { if (typeof u === 'function') cleanupFns.push(u); });
      } catch (err) {
        console.warn('SeatSelection: fallo al suscribirse a NotificationHub', err);
      }
    })();

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      cleanupFns.forEach(fn => { try { fn(); } catch {} });
      leaveEventChannel(eventNumeric).catch(() => {});
    };
  }, [eventoId]);

  const zonasMap = useMemo(() => 
    zonas.reduce((acc, zona) => {
      acc[zona.id] = zona;
      return acc;
    }, {} as Record<number, Zona>),
  [zonas]);

  const applyReservationOverlay = (seats: Asiento[]) => {
    if (!reservedSeatIds || reservedSeatIds.size === 0) return seats;
    return seats.map(s => reservedSeatIds.has(String(s.id)) ? { ...s, estado: 'ocupado' as const } : s);
  };

  const reconcileSelection = (latestSeats: Asiento[]) => {
    if (!latestSeats || latestSeats.length === 0 || selectedSeats.length === 0) return;
    const occupiedIds = new Set(
      latestSeats
        .filter(s => s.estado !== 'disponible')
        .map(s => String(s.id))
    );
    const toRemove = selectedSeats.filter(s => occupiedIds.has(String(s.id)));
    if (toRemove.length > 0) {
      setSelectedSeats(prev => prev.filter(s => !occupiedIds.has(String(s.id))));
      alert(t('seat.holdTaken'));
    }
  };

  const updateHold = async (nextSeats: Asiento[]) => {
    if (!evento) return true;
    // Si la selección no cambió respecto al hold actual, no reprocesar
    const nextIds = nextSeats.map(s => String(s.id)).sort();
    if (holdSeatIds.length === nextIds.length && holdSeatIds.every((id, idx) => id === nextIds[idx]) && holdToken) {
      return true;
    }
    setUpdatingHold(true);
    try {
      if (nextSeats.length === 0) {
        // If user deselected everything, release previous hold
        if (holdToken) {
          try { await reservationsApi.releaseHold(holdToken); console.log('[SeatSelection] released previous hold', { holdToken }); } catch (e: any) {
            const msg = String(e?.message || '');
            if (!msg.includes('404')) console.warn('[SeatSelection] release previous hold failed', e);
          }
        }

        setHoldToken(null);
        setHoldExpires(null);
        setHoldExpiresIso(null);
        try {
          sessionStorage.removeItem(`hold_token_${evento.id}`);
          sessionStorage.removeItem(`hold_expires_${evento.id}`);
        } catch {}
        return true;
      }

      // registrar seats en vuelo para reconocer el evento de hold propio
      pendingHoldRef.current = { seatIds: nextSeats.map(s => String(s.id)).sort() };
      const payload = {
        eventoId: evento.id,
        seats: nextSeats.map(s => ({ asientoId: s.id, precio: zonas.find(z => z.id === s.zonaId)?.precio || 0 })),
        durationMinutes: 10
      };
      console.log('[SeatSelection] createHold payload', payload);
      const holdRes: any = await reservationsApi.createHold(payload);
      console.log('[SeatSelection] createHold response', holdRes);
      const expiresAtIso = new Date(holdRes.expiresAt).toISOString();
      setHoldToken(holdRes.token);
      setHoldExpires(holdRes.expiresAt);
      setHoldExpiresIso(expiresAtIso);
      setHoldRemaining(Math.max(0, Math.floor((new Date(expiresAtIso).getTime() - Date.now()) / 1000)));
      setHoldSeatIds(nextIds); // Guardar seatIds del hold actual
      try {
        sessionStorage.setItem(`hold_token_${evento.id}`, holdRes.token);
        sessionStorage.setItem(`hold_expires_${evento.id}`, expiresAtIso);
      } catch {}
      pendingHoldRef.current = null;
      return true;
    } catch (err: any) {
      const msg = String(err?.message || '');
      console.warn('[SeatSelection] hold error', msg, err);
      if (msg.toLowerCase().includes('conflict') || msg.toLowerCase().includes('already held')) {
        console.warn('[SeatSelection] conflict detected, refreshing seats');
        // Marcar localmente los asientos que intentamos como ocupados para evitar reintentos inmediatos
        const attemptedIds = nextSeats.map(s => String(s.id));
        if (attemptedIds.length > 0) {
          setAsientos(prev => prev.map(seat => attemptedIds.includes(String(seat.id)) ? { ...seat, estado: 'ocupado' as const } : seat));
          setSelectedSeats(prev => prev.filter(s => !attemptedIds.includes(String(s.id))));
        }
        alert(t('seat.holdConflict'));
        clearHoldState();
        try {
          if (!stageId) return false;
          const { seats: mappedSeats, zonas: mappedZonas } = await eventsApi.getSeats(stageId);
          console.log('[SeatSelection] refresh seats after conflict', { seats: mappedSeats?.length });
          setAsientos(mappedSeats);
          setZonas(mappedZonas);
        } catch {}
      } else {
        console.error('Hold update failed', err);
      }
      return false;
    } finally {
      setUpdatingHold(false);
    }
  };

  const clearHoldState = () => {
    setSelectedSeats([]);
    pendingHoldRef.current = null;
    setHoldToken(null);
    setHoldExpires(null);
    setHoldExpiresIso(null);
    setHoldSeatIds([]);
    try {
      sessionStorage.removeItem(`hold_token_${evento?.id ?? eventoId}`);
      sessionStorage.removeItem(`hold_expires_${evento?.id ?? eventoId}`);
    } catch {}
  };

  const handleClearAndReload = async () => {
    clearHoldState();
    setUpdatingHold(true);
    try {
      if (stageId) {
        const { seats: mappedSeats, zonas: mappedZonas } = await eventsApi.getSeats(stageId);
        setAsientos(mappedSeats);
        setZonas(mappedZonas);
      } else {
        setAsientos([]);
        setZonas([]);
      }
    } catch (e) {
      console.error('Failed to reload seats', e);
    } finally {
      setUpdatingHold(false);
    }
  };

  // Al montar, limpiar estado local y recargar asientos para evitar tokens caducos
  useEffect(() => {
    handleClearAndReload().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce para agrupar cambios rápidos de selección y evitar múltiples peticiones
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSelectionRef = useRef<Asiento[] | null>(null);

  const triggerHoldUpdate = (next: Asiento[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pendingSelectionRef.current = next;
    debounceRef.current = setTimeout(() => {
      if (pendingSelectionRef.current) {
        void updateHold(pendingSelectionRef.current);
        pendingSelectionRef.current = null;
      }
    }, 200); // 200ms debounce
  };

  const toggleSeatSelection = (seat: Asiento) => {
    if (seat.estado === 'ocupado' || updatingHold) return;
    setSelectedSeats(prev => {
      const exists = prev.find(s => s.id === seat.id);
      const next = exists ? prev.filter(s => s.id !== seat.id) : [...prev, seat];
      triggerHoldUpdate(next);
      return next;
    });
  };

  const total = selectedSeats.reduce((acc, seat) => acc + (zonasMap[seat.zonaId]?.precio || 0), 0);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!holdExpiresIso) {
      setHoldRemaining(0);
      return;
    }
    const updateRemaining = () => {
      const remaining = Math.max(0, Math.floor((new Date(holdExpiresIso).getTime() - Date.now()) / 1000));
      setHoldRemaining(remaining);
      if (remaining <= 0) {
        setHoldToken(null);
        setHoldExpires(null);
        setHoldExpiresIso(null);
        setSelectedSeats([]);
        try {
          sessionStorage.removeItem(`hold_token_${eventoId}`);
          sessionStorage.removeItem(`hold_expires_${eventoId}`);
        } catch {}
      }
    };
    updateRemaining();
    timerRef.current = setInterval(updateRemaining, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [holdExpiresIso, eventoId]);

  const handleCheckout = () => {
    // create a server-side hold for the selected seats (10 minutes)
    (async () => {
      try {
        const payload = { eventoId: evento?.id, seats: selectedSeats.map(s => ({ asientoId: s.id, precio: zonasMap[s.zonaId]?.precio || 0 })), durationMinutes: 10 };
        const holdRes: any = await reservationsApi.createHold(payload).catch((e: any) => { throw e; });
        // store hold token and expiry in sessionStorage scoped to event
        try {
          sessionStorage.setItem(`hold_token_${evento?.id}`, holdRes.token);
          sessionStorage.setItem(`hold_expires_${evento?.id}`, new Date(holdRes.expiresAt).toISOString());
        } catch {}
        setHoldExpiresIso(new Date(holdRes.expiresAt).toISOString());
        navigate('/checkout', { state: { selectedSeats, evento, zonasMap, holdToken: holdRes.token, holdExpires: holdRes.expiresAt } });
      } catch (err: any) {
        console.error('Failed to create hold', err);
        // Show a more specific error message when possible
        const msg = err?.message ?? t('seat.loginRequired');
        if (msg.includes('401') || msg === 'SESSION_EXPIRED' || msg.includes('403')) {
          alert(t('seat.loginRequired'));
        } else if (msg.includes('Seat already')) {
          alert(t('seat.holdTaken'));
        } else {
          alert(msg);
        }
      }
    })();
  };
  
  if (loading) return <div className="text-center p-10">{t('seat.loadingMap')}</div>;
  if (!evento) return <div className="text-center p-10">{t('seat.eventNotFound')}</div>;
  
  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
      {/* Hold banner (prominent) */}
      {holdToken && holdRemaining > 0 && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-11/12 max-w-3xl">
          <div className="bg-red-600 text-white p-3 rounded-lg shadow-lg text-center font-bold text-lg">
            ¡Asientos reservados temporalmente! Tiempo restante: {Math.floor(holdRemaining/60)}:{String(holdRemaining%60).padStart(2,'0')}
            <button className="ml-4 underline text-sm font-normal" onClick={async () => {
              try { await reservationsApi.releaseHold(holdToken); } catch {};
              sessionStorage.removeItem(`hold_token_${evento.id}`);
              sessionStorage.removeItem(`hold_expires_${evento.id}`);
              setHoldToken(null); setHoldExpires(null); setHoldExpiresIso(null); setHoldRemaining(0);
              // refresh seat map
              const { seats: mappedSeats } = await eventsApi.getSeats(evento.stageId);
              setAsientos(mappedSeats);
            }}>Liberar hold</button>
          </div>
        </div>
      )}
      {/* Seat Map */}
      <div className="flex-grow p-4 overflow-auto">
        <h2 className="text-2xl font-bold text-center mb-4">Selecciona tus Asientos</h2>
        <div className="bg-base-300/50 w-full p-4 text-center text-white font-bold rounded-t-lg">ESCENARIO</div>
        <div className="p-8 bg-base-200 rounded-b-lg flex flex-col items-center gap-8 w-full">
          {/* Render each zone as a matrix: group seats by fila and sort by fila/numero */}
          {zonas.map((zona) => {
            const seatsForZone = asientos.filter(a => a.zonaId === zona.id);
            if (!seatsForZone || seatsForZone.length === 0) return null;
            // determine row ordering from seat.fila (e.g., 'R1', 'R2')
            const filaKeys = Array.from(new Set(seatsForZone.map(s => s.fila ?? ''))).filter(f => f) as string[];
            const parseFila = (f: string) => {
              const m = (f || '').toString().match(/(\d+)/);
              return m ? Number(m[1]) : 0;
            };
            filaKeys.sort((a, b) => parseFila(a) - parseFila(b));

            return (
              <div key={zona.id} className="w-full">
                <div className="flex items-center justify-between mb-2 px-4">
                  <div className="text-lg font-semibold">{zona.nombre}</div>
                  <div className="text-sm text-gray-300">Precio: ${zona.precio?.toFixed ? zona.precio.toFixed(2) : (zona.precio ?? 0)}</div>
                </div>
                <div className="inline-block bg-black p-4 rounded w-full">
                  {filaKeys.map((filaKey) => {
                    const seatsInRow = seatsForZone
                      .filter(s => s.fila === filaKey)
                      .sort((x, y) => Number(x.numero) - Number(y.numero));
                    return (
                      <div key={filaKey} className="flex gap-2 mb-2 justify-center">
                        {seatsInRow.map(seat => (
                          <Seat key={seat.id} seat={seat} zona={zonasMap[seat.zonaId]} onSelect={toggleSeatSelection} isSelected={!!selectedSeats.find(s => s.id === seat.id)} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Sidebar */}
      <aside className="w-full lg:w-96 bg-base-200 p-6 flex flex-col shadow-lg">
        <h2 className="text-2xl font-bold mb-4">{evento.nombre}</h2>
        {holdToken && holdRemaining > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-red-700 text-white text-center font-semibold">
            Tiempo para completar: {Math.floor(holdRemaining/60)}:{String(holdRemaining%60).padStart(2,'0')}
          </div>
        )}
        <div className="flex-grow overflow-y-auto">
          <h3 className="text-lg font-semibold text-primary mb-2">Asientos Seleccionados</h3>
          {selectedSeats.length === 0 ? (
            <p className="text-gray-400">No has seleccionado ningún asiento.</p>
          ) : (
            <ul className="space-y-2">
              {selectedSeats.map(seat => (
                <li key={seat.id} className="flex justify-between items-center bg-base-300 p-2 rounded">
                  <div>
                    <span className="font-semibold">{seat.fila} - {seat.numero}</span>
                    <span className="text-sm text-gray-400 ml-2">({zonasMap[seat.zonaId]?.nombre})</span>
                  </div>
                  <span className="font-bold">${zonasMap[seat.zonaId]?.precio.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-auto pt-4 border-t border-gray-700">
          <div className="flex justify-between items-center text-2xl font-bold mb-4">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <Button
            onClick={handleClearAndReload}
            disabled={updatingHold}
            variant="secondary"
            className="w-full mb-3"
          >
            {updatingHold ? 'Actualizando...' : 'Limpiar selección y recargar'}
          </Button>
        <Button onClick={handleCheckout} disabled={selectedSeats.length === 0 || updatingHold} className="w-full" size="lg">
            {updatingHold ? 'Actualizando bloqueo...' : 'Proceder al Pago'}
          </Button>
        </div>
      </aside>
    </div>
  );
};

// FIX: Define Seat as a React.FC with explicit props to handle the 'key' prop correctly.
interface SeatProps {
  seat: Asiento;
  zona: Zona;
  onSelect: (seat: Asiento) => void;
  isSelected: boolean;
}

const Seat: React.FC<SeatProps> = ({ seat, zona, onSelect, isSelected }) => {
  const stateClasses = {
    disponible: 'cursor-pointer hover:opacity-80',
    ocupado: 'bg-gray-600 cursor-not-allowed opacity-50',
    hold: 'bg-amber-600 cursor-not-allowed opacity-80',
    seleccionado: 'ring-4 ring-white shadow-lg'
  };

  const currentStatus = isSelected ? 'seleccionado' : seat.estado;

  return (
    <button
      onClick={() => onSelect(seat)}
      disabled={seat.estado === 'ocupado'}
      className={`w-10 h-10 rounded text-xs font-bold text-white flex items-center justify-center transition-all ${stateClasses[currentStatus]}`}
      style={{ backgroundColor: seat.estado !== 'ocupado' && seat.estado !== 'hold' ? zona.color : undefined }}
      title={`${seat.fila} - ${seat.numero}\n${zona.nombre} - $${zona.precio.toFixed(2)}`}
    >
      {seat.numero}
    </button>
  );
};