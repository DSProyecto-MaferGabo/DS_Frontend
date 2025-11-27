import React, { useState, useEffect } from 'react';
import type { Reservacion, Evento } from '../../types';
import api from '../../services/api';
import reservationsApi from '../../services/reservationsApi';
import eventsApi from '../../services/eventsApi';
import { useKeycloak } from '../../hooks/useKeycloak';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';

type Tab = 'reservaciones' | 'asistidos' | 'pagos';

interface PopulatedReservacion extends Reservacion {
  evento?: Evento;
}

export const UserProfile = () => {
  const [activeTab, setActiveTab] = useState<Tab>('reservaciones');
  const [reservaciones, setReservaciones] = useState<PopulatedReservacion[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useKeycloak();
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;
      setLoading(true);
      try {
        const [reservacionesData, eventosData] = await Promise.all([
          // fetch reservations from Reservations-service
          reservationsApi.getReservations(profile.id),
          // fetch events from Events-service
          eventsApi.getEvents(),
        ]);
        
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

        setReservaciones(reservationsList);

      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile]);

  const renderContent = () => {
    if(loading) return <div className="text-center p-8">Cargando tus datos...</div>;
    switch (activeTab) {
      case 'reservaciones':
        const activas = reservaciones.filter(r => new Date(r.evento?.fecha || 0) >= new Date());
        const toggleExpanded = (id: string | number) => setExpandedIds(prev => ({ ...prev, [String(id)]: !prev[String(id)] }));

        return activas.length > 0 ? (
          <div className="space-y-4">
            {activas.map(res => (
              <div key={res.id} className="bg-base-300 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg text-white">{res.evento?.nombre || 'Evento Desconocido'}</h3>
                    <p className="text-sm text-gray-400">Fecha de compra: {new Date(res.fecha).toLocaleDateString()}</p>
                    <p className="text-sm text-gray-400">Total: ${Number(res.total || 0).toFixed(2)}</p>
                    {res.couponCode && (
                      <p className="text-sm text-green-300">Cupón: <span className="font-semibold">{res.couponCode}</span> — Descuento: ${Number(res.discountAmount ?? 0).toFixed(2)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {(() => {
                      const st = String(res.estado || '').toLowerCase();
                      const isPaid = st === 'paid' || st === 'confirmada';
                      const label = st === 'paid' ? 'Pagado' : (st === 'confirmada' ? 'Confirmada' : (res.estado || ''));
                      return (
                        <span className={`px-3 py-1 text-sm font-semibold rounded-full ${isPaid ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                          {label}
                        </span>
                      );
                    })()}

                    <div className="flex items-center gap-2">
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
                      {res.services && res.services.length > 0 ? (
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
            ))}
          </div>
        ) : <p className="text-gray-400">No tienes reservaciones para eventos futuros.</p>;
      case 'asistidos':
          const pasadas = reservaciones.filter(r => new Date(r.evento?.fecha || 0) < new Date());
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
        return <p className="text-gray-400">Esta funcionalidad está en construcción.</p>;
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
