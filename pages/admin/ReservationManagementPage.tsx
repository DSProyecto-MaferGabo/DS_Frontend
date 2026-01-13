import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import reservationsApi from '../../services/reservationsApi';
import eventsApi from '../../services/eventsApi';
import type { Reservacion, Evento, Usuario } from '../../types';

interface PopulatedReservacion extends Reservacion {
    evento?: Evento;
    usuario?: Usuario;
}

export const ReservationManagementPage = () => {
    const [reservaciones, setReservaciones] = useState<PopulatedReservacion[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
    const [seatsByStage, setSeatsByStage] = useState<Record<number, { seats: any[]; zonas: any[] }>>({});
    const [usersForbidden, setUsersForbidden] = useState(false);
    const [additionalServicesMap, setAdditionalServicesMap] = useState<Record<number, any>>({});

    const fetchReservaciones = useCallback(async () => {
        setLoading(true);
        let reservacionesData: any[] = [];
        let eventosData: any[] = [];
        let usuariosData: any[] = [];
        try {
            // fetch reservations, events and users independently so a 404 in one doesn't break the rest
            try {
                reservacionesData = await reservationsApi.getReservations();
            } catch (e) {
                console.warn('Could not load reservations (continuing with empty list):', e);
                reservacionesData = [];
            }

            try {
                eventosData = await eventsApi.getMyEvents();
            } catch (e) {
                console.warn('Could not load events (continuing with empty list):', e);
                eventosData = [];
            }

                try {
                    usuariosData = await api.get<Usuario[]>('/User');
                } catch (e: any) {
                    // If API returns 403 (AdminOnly), suppress noisy console errors and set a flag
                    if (String(e.message || '').includes('403')) {
                        setUsersForbidden(true);
                    } else {
                        console.warn('Could not load usuarios (continuing with empty list):', e);
                    }
                    usuariosData = [];
                }

            // set events state even if empty so UI can render
            setEvents(eventosData || []);

            const eventosMap = new Map((eventosData || []).map((e: any) => [e.id, e]));
            // normalize users: backend may return PascalCase (Name/Email) or camelCase
            const normalizedUsers = (usuariosData || []).map((u: any) => {
                const id = u.Id ?? u.id ?? u.Id ?? u.ID;
                const name = u.Name ?? u.name ?? u.Nombre ?? u.nombre ?? '';
                const email = u.Email ?? u.email ?? u.emailAddress ?? '';
                // split name into given/surname heuristically
                const parts = (name || '').trim().split(/\s+/);
                const givenName = parts.length ? parts[0] : '';
                const familyName = parts.length > 1 ? parts.slice(1).join(' ') : '';
                return { ...u, id, nombre: name, name, givenName, familyName, email };
            });

            const usuariosMap = new Map<any, any>();
            normalizedUsers.forEach(u => {
                usuariosMap.set(u.id, u);
                usuariosMap.set(String(u.id), u);
            });
            const usuariosByEmail = new Map((normalizedUsers || []).map((u: any) => [String(u.email || '').toLowerCase(), u]));

            const populatedData = (reservacionesData || []).map((res: any) => ({
                ...res,
                evento: eventosMap.get(res.eventoId),
                usuario: usuariosMap.get(res.usuarioId) ?? usuariosByEmail.get(String((res.usuarioEmail || res.usuario?.email || '')).toLowerCase())
            })).filter((res: any) => res.evento); // Filter to only reservations for organizer's events

            // If we couldn't list users (forbidden), try to enrich reservations by querying user-by-email per reservation
            const tryEnrichUsersByEmail = async (list: any[]) => {
                const missingEmails = Array.from(new Set(list.filter(r => !r.usuario && (r.usuarioEmail || r.usuario?.email)).map(r => (r.usuarioEmail || r.usuario?.email))));
                if (missingEmails.length === 0) return;
                await Promise.allSettled(missingEmails.map(async (email) => {
                    try {
                        const u = await api.get<any>(`/User/by-email/${encodeURIComponent(email)}`);
                        // apply to reservations matching this email
                        list.forEach(r => {
                            if ((r.usuarioEmail || r.usuario?.email) === email) r.usuario = u;
                        });
                    } catch (e) {
                        // ignore
                    }
                }));
            };

            // load additional services map for rendering service names/prices
            try {
                const allServices = await reservationsApi.getAdditionalServices();
                const map: Record<number, any> = {};
                (allServices || []).forEach((s: any) => { map[s.Id ?? s.id] = s; });
                setAdditionalServicesMap(map);
            } catch (e) {
                // ignore
                setAdditionalServicesMap({});
            }

            await tryEnrichUsersByEmail(populatedData);

            // merge with any local reservations persisted by the simulated payment flow
            try {
                const localKey = 'local_reservaciones';
                const local = JSON.parse(localStorage.getItem(localKey) || '[]') as any[];
                if (local.length) {
                    const map = new Map<string, any>();
                    populatedData.forEach((r: any) => map.set(String(r.id), r));
                    const localPopulated = local.map(r => ({
                        ...r,
                        evento: eventosMap.get(r.eventoId),
                        usuario: usuariosMap.get(r.usuarioId) ?? usuariosByEmail.get(r.usuarioEmail)
                    }));
                    localPopulated.forEach(r => {
                        const key = String(r.id ?? r.reservationId ?? `${r.eventoId}:${r.fecha}`);
                        if (!map.has(key)) map.set(key, r);
                    });
                    setReservaciones(Array.from(map.values()));
                } else {
                    setReservaciones(populatedData);
                }
            } catch (e) {
                setReservaciones(populatedData);
            }

        } catch (error) {
            console.error('Error fetching reservations:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReservaciones();
    }, [fetchReservaciones]);

            if (loading) return <p>Cargando reservaciones y eventos...</p>;

            // Build a map of reservations per event
            const reservationsByEvent = new Map<number, PopulatedReservacion[]>();
            reservaciones.forEach(r => {
                const evId = Number((r as any).eventoId ?? r.eventoId);
                if (!reservationsByEvent.has(evId)) reservationsByEvent.set(evId, []);
                reservationsByEvent.get(evId)!.push(r);
            });

            // Events grid
            return (
                <div>
                    <h1 className="text-3xl font-bold mb-6">Gestión de Reservaciones</h1>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {events.map(ev => {
                            const count = reservationsByEvent.get(ev.id)?.length || 0;
                            return (
                                <div key={ev.id} className="bg-base-200 rounded-lg overflow-hidden shadow cursor-pointer" onClick={async () => {
                                    // select event and load seats for its stage
                                    setSelectedEventId(ev.id);
                                    const sId = ev.stageId;
                                    if (sId && !seatsByStage[sId]) {
                                        try {
                                            const got = await eventsApi.getSeats(sId);
                                            setSeatsByStage(prev => ({ ...prev, [sId]: { seats: got.seats || [], zonas: got.zonas || [] } }));
                                        } catch (e) { console.error('Error loading seats for stage', e); }
                                    }
                                }}>
                                    <img src={ev.posterUrl} alt={ev.nombre} className="w-full h-40 object-cover" />
                                    <div className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-lg">{ev.nombre}</div>
                                                <div className="text-sm text-gray-400">{new Date(ev.fecha).toLocaleDateString()} · {ev.ubicacion}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm text-gray-400">Reservas</div>
                                                <div className="font-semibold text-xl">{count}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Selected event details */}
                    {selectedEventId && (() => {
                        const ev = events.find(e => e.id === selectedEventId);
                        const list = reservationsByEvent.get(selectedEventId) || [];
                        const stageIdForEvent = ev?.stageId;
                        const stageSeatsObj = stageIdForEvent ? seatsByStage[stageIdForEvent] : undefined;

                        // compute seat status map (sold/reserved/available) and attach buyer info
                        const seatStatus: Record<string, { status: 'disponible'|'reservado'|'vendido', buyer?: any }> = {};
                        const seatMap: Record<string, { label: string; precio: number }> = {};
                        if (stageSeatsObj && stageSeatsObj.seats) {
                            const zonas = stageSeatsObj.zonas || [];
                            stageSeatsObj.seats.forEach((s: any) => {
                                const key = String(s.rawId ?? s.id ?? `${s.escenarioId}-${s.fila}-${s.numero}`);
                                seatStatus[key] = { status: 'disponible' };
                                const zonaInfo = zonas.find((z: any) => z.id === s.zonaId) || { nombre: s.zone || String(s.zonaId || 'General'), precio: s.precio ?? s.price ?? 0 };
                                const label = `${zonaInfo.nombre} — ${s.fila}${s.numero ? `-${s.numero}` : ''}`;
                                seatMap[key] = { label, precio: zonaInfo.precio ?? 0 };
                            });
                        }

                        const isReservationPaid = (r: any) => {
                            if ((r as any).paid) return true;
                            const estado = String(r.estado ?? '').toLowerCase();
                            return ['confirmada', 'confirmado', 'paid', 'pagada', 'pagado', 'completada', 'completado', 'completed'].includes(estado);
                        };

                        list.forEach(r => {
                            const isSold = isReservationPaid(r);
                                (r as any).seats && (r as any).seats.forEach((seatItem: any) => {
                                const asientoId = String(seatItem.asientoId ?? seatItem.asiento ?? seatItem.id ?? seatItem.asientoRawId ?? '');
                                // try match by rawId or unique id
                                const matchedKey = Object.keys(seatStatus).find(k => k === asientoId || k === String(seatItem.rawId ?? seatItem.id)) || asientoId;
                                seatStatus[matchedKey] = { status: isSold ? 'vendido' : 'reservado', buyer: { name: (r.usuario as any)?.nombre ?? (r.usuario as any)?.name, email: (r.usuario as any)?.email } };
                            });
                        });

                        // aggregate per zone
                        const zoneCounts: Record<string, { disponible: number; reservado: number; vendido: number }> = {};
                        if (stageSeatsObj && stageSeatsObj.seats) {
                            const zonas = stageSeatsObj.zonas || [];
                            stageSeatsObj.seats.forEach(s => {
                                const zoneName = (zonas.find((z:any)=>z.id===s.zonaId)?.nombre) || s.zone || String(s.zonaId || 'General');
                                zoneCounts[zoneName] = zoneCounts[zoneName] || { disponible:0, reservado:0, vendido:0 };
                                const key = String(s.rawId ?? s.id ?? `${s.escenarioId}-${s.fila}-${s.numero}`);
                                const ss = seatStatus[key]?.status ?? 'disponible';
                                if (ss === 'disponible') zoneCounts[zoneName].disponible += 1;
                                else if (ss === 'reservado') zoneCounts[zoneName].reservado += 1;
                                else if (ss === 'vendido') zoneCounts[zoneName].vendido += 1;
                            });
                        }

                        return (
                            <div className="bg-base-200 p-4 rounded-lg">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h2 className="text-2xl font-bold">Detalles — {ev?.nombre}</h2>
                                        <div className="text-sm text-gray-400">{new Date(ev?.fecha || '').toLocaleString()} · {ev?.ubicacion}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-gray-400">Total reservas</div>
                                        <div className="font-semibold text-xl">{list.length}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <h3 className="font-semibold mb-2">Reservas</h3>
                                        {list.length === 0 ? <p className="text-gray-400">No hay reservas para este evento.</p> : (
                                            <ul className="space-y-2">
                                                {list.map(r => (
                                                    <li key={r.id} className="p-3 bg-base-300 rounded flex justify-between items-start">
                                                        <div>
                                                            <div className="font-semibold">
                                                                {(
                                                                    (r.usuario as any)?.nombre || (r.usuario as any)?.name || (((r.usuario as any)?.givenName) ? `${(r.usuario as any).givenName} ${(r.usuario as any).familyName || ''}`.trim() : null) || 'Usuario desconocido'
                                                                )}
                                                                <span className="text-sm text-gray-400"> ({(r.usuario as any)?.email})</span>
                                                            </div>
                                                            <div className="text-sm text-gray-400">Estado: {r.estado} • Total: ${Number(r.total||0).toFixed(2)} • Fecha: {new Date(r.fecha).toLocaleString()}</div>
                                                            {(r as any).seats && (r as any).seats.length > 0 && (
                                                                <div className="mt-2 text-sm">
                                                                    <div className="font-semibold">Asientos:</div>
                                                                    <ul className="list-disc pl-5">
                                                                        {(r as any).seats.map((s:any, idx:number) => {
                                                                            const asientoId = String(s.asientoId ?? s.asiento ?? s.id ?? s.asientoRawId ?? '');
                                                                            const matchedKey = Object.keys(seatMap).find(k => k === asientoId || k === String(s.rawId ?? s.id)) || asientoId;
                                                                            const info = seatMap[matchedKey];
                                                                            return (
                                                                                <li key={idx}>{info ? `${info.label} — $${Number(s.precio ?? s.price ?? info.precio ?? 0).toFixed(2)}` : (s.asientoId ?? s.asiento ?? s.id)}</li>
                                                                            );
                                                                        })}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            {/* Additional services requested */}
                                                            {((r as any).additionalServiceIds && (r as any).additionalServiceIds.length > 0) || ((r as any).additionalServices && (r as any).additionalServices.length > 0) ? (
                                                                <div className="mt-2 text-sm">
                                                                    <div className="font-semibold">Servicios solicitados:</div>
                                                                    <ul className="list-disc pl-5">
                                                                        {((r as any).additionalServiceIds || (r as any).additionalServices || []).map((sid:any, idx:number) => {
                                                                            const id = typeof sid === 'object' ? (sid.Id ?? sid.id) : sid;
                                                                            const svc = additionalServicesMap[id];
                                                                            if (svc) return <li key={idx}>{svc.Name ?? svc.name} — ${Number(svc.Price ?? svc.price ?? 0).toFixed(2)}</li>;
                                                                            if (typeof sid === 'object') return <li key={idx}>{sid.Name || sid.name || JSON.stringify(sid)}</li>;
                                                                            return <li key={idx}>Servicio #{id}</li>;
                                                                        })}
                                                                    </ul>
                                                                </div>
                                                            ) : null}
                                                                {/* Handle reservations where backend returns a `services` array (id,name,price) */}
                                                                {((r as any).services && (r as any).services.length > 0) ? (
                                                                    <div className="mt-2 text-sm">
                                                                        <div className="font-semibold">Servicios solicitados:</div>
                                                                        <ul className="list-disc pl-5">
                                                                            {(r as any).services.map((svc:any, idx:number) => (
                                                                                <li key={idx}>{svc.name ?? svc.Name ?? `Servicio #${svc.id}`} — ${Number(svc.price ?? svc.Price ?? 0).toFixed(2)}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                ) : null}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="font-semibold mb-2">Distribución por zona</h3>
                                        {Object.keys(zoneCounts).length === 0 ? <p className="text-gray-400">No hay datos del escenario o zonas.</p> : (
                                            <div className="space-y-3">
                                                {Object.entries(zoneCounts).map(([zn, counts]) => (
                                                    <div key={zn} className="p-3 bg-base-300 rounded">
                                                        <div className="flex justify-between items-center">
                                                            <div className="font-semibold">{zn}</div>
                                                            <div className="text-sm text-gray-400">Total: {counts.disponible + counts.reservado + counts.vendido}</div>
                                                        </div>
                                                        <div className="mt-2 text-sm text-gray-400">Disponible: {counts.disponible} · Reservado: {counts.reservado} · Vendido: {counts.vendido}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Simple seat map preview (per zone rows) */}
                                        {stageSeatsObj && stageSeatsObj.seats && (
                                            <div className="mt-4">
                                                <h4 className="font-semibold mb-2">Mapa rápido del escenario</h4>
                                                <div className="inline-block bg-black p-3 rounded">
                                                    {(() => {
                                                        const zonasList = (stageSeatsObj.zonas || []).length ? stageSeatsObj.zonas : [{ id: null, nombre: 'General' }];
                                                        return zonasList.map((z:any) => {
                                                            const seatsForZone = stageSeatsObj.seats.filter((s:any) => s.zonaId === z.id || s.zone === z.nombre || (!s.zonaId && s.zone === z.nombre));
                                                            const rowsMap: Record<string, any[]> = {};
                                                            seatsForZone.forEach((s:any) => { rowsMap[s.fila] = rowsMap[s.fila] || []; rowsMap[s.fila].push(s); });
                                                            const rows = Object.keys(rowsMap).sort((a,b)=> { const an = parseInt(a.replace(/[^0-9]/g,''))||0; const bn = parseInt(b.replace(/[^0-9]/g,''))||0; return an-bn; });
                                                            return (
                                                                <div key={z.id} className="mb-4">
                                                                    <div className="text-sm font-semibold text-white mb-2">{z.nombre}</div>
                                                                    {rows.map(rn => (
                                                                        <div key={rn} className="flex gap-2 mb-2">
                                                                            {rowsMap[rn].sort((a:any,b:any)=> parseInt(String(a.numero||'0'))-parseInt(String(b.numero||'0'))).map((s:any)=> {
                                                                                const seatKey = String(s.rawId ?? s.id ?? `${s.escenarioId}-${s.fila}-${s.numero}`);
                                                                                const st = seatStatus[seatKey]?.status ?? 'disponible';
                                                                                const baseColor = st === 'vendido' ? 'bg-gray-700' : st === 'reservado' ? 'bg-yellow-500' : 'bg-green-600';
                                                                                return (
                                                                                    <div key={seatKey} className={`w-7 h-7 rounded flex items-center justify-center text-xs ${baseColor}`} title={seatStatus[seatKey]?.buyer ? `${seatStatus[seatKey].buyer.name} (${seatStatus[seatKey].buyer.email})` : s.numero}>
                                                                                        <span className="text-white text-xs">{s.numero}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                                <div className="mt-3 text-sm">
                                                    <div className="flex items-center gap-4"><span className="w-4 h-4 bg-green-600 rounded" /> Disponible</div>
                                                    <div className="flex items-center gap-4"><span className="w-4 h-4 bg-yellow-500 rounded" /> Reservado</div>
                                                    <div className="flex items-center gap-4"><span className="w-4 h-4 bg-gray-700 rounded" /> Vendido</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            );
};
