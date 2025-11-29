import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import eventsApi from '../../services/eventsApi';
import reservationsApi from '../../services/reservationsApi';
import type { Evento } from '../../types';
import { Button } from '../../components/ui/Button';
import { CalendarIcon, MapPinIcon } from '@heroicons/react/24/solid';
import { EventCard } from '../../components/EventCard';

export const EventDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [loading, setLoading] = useState(true);
  const [zonasAvailability, setZonasAvailability] = useState<any[]>([]);
  const [recommended, setRecommended] = useState<Evento[]>([]);
  const carouselRef = React.useRef<HTMLDivElement | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  useEffect(() => {
    const fetchEvento = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await eventsApi.getEvent(Number(id));
        setEvento(data);
          // if location missing, try to fetch stage info
          if ((!data.ubicacion || String(data.ubicacion).trim() === '') && (data as any).stageId) {
            try {
              const st = await eventsApi.getStage((data as any).stageId);
              if (st && (st.location || st.Location)) {
                setEvento(prev => ({ ...(prev || {}), ubicacion: st.location ?? st.Location } as Evento));
              }
            } catch (e) {
              // ignore
            }
          }
          // load recommended events (exclude current), filter out past events
          try {
            const all = await eventsApi.getEvents();
            const now = new Date();
            const buildDateTime = (fecha?: string, hora?: string | null) => {
              if (!fecha) return null;
              try {
                const [y, m, d] = fecha.split('-').map(Number);
                if (hora) {
                  const [hh, mm] = (hora || '').split(':').map((s: any) => Number(s));
                  return new Date(y, m - 1, d, hh ?? 0, mm ?? 0);
                }
                return new Date(y, m - 1, d);
              } catch { return null; }
            };

            const rec = (all || [])
              .filter((e:any) => Number(e.id) !== Number(id))
              .filter((e:any) => {
                try {
                  const dt = buildDateTime(e.fecha, e.hora ?? e.time ?? null);
                  if (!dt) return true;
                  return dt >= now;
                } catch (ex) { return true; }
              })
              .slice(0,8);
            setRecommended(rec as Evento[]);
          } catch (e) { console.warn('Could not load recommended events', e); }
        // load seats and compute availability per zona
        try {
          const stageId = (data as any).stageId;
          if (stageId) {
            const got = await eventsApi.getSeats(stageId);
            const seats = got.seats || [];
            const zonas = got.zonas || [];

            // fetch reservations for this event to determine reserved seats
            let reservedSeatIds: Set<string> = new Set();
            try {
              const allRes = await reservationsApi.getReservations();
              const eventRes = (allRes || []).filter((r: any) => Number(r.eventoId) === Number(id) || Number(r.eventoId) === Number((data as any).id));
              eventRes.forEach((r: any) => {
                (r.seats || []).forEach((s: any) => reservedSeatIds.add(String(s.asientoId ?? s.asiento ?? s.id ?? s.rawId ?? '')));
              });
            } catch (e) {
              console.warn('Could not load reservations to compute availability', e);
            }

            // build availability per zona
            const zonasInfo = (zonas || []).map((z: any) => {
              const seatsInZona = (seats || []).filter((s: any) => s.zonaId === z.id || s.zone === z.nombre || String(s.zonaId) === String(z.id));
              const total = seatsInZona.length;
              let reserved = 0;
              seatsInZona.forEach((s: any) => {
                const sid = String(s.rawId ?? s.id ?? s.id);
                if (reservedSeatIds.has(sid)) reserved++;
              });
              return { id: z.id, nombre: z.nombre, precio: z.precio ?? z.price, total, available: Math.max(0, total - reserved) };
            });
            setZonasAvailability(zonasInfo);
          }
        } catch (e) {
          console.warn('Could not load seats/zonas for availability', e);
        }
      } catch (error) {
        console.error("Error fetching event details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvento();
  }, [id]);

  // Manage carousel overflow and fades
  useEffect(() => {
    const el = carouselRef.current;
    const update = () => {
      const node = carouselRef.current;
      if (!node) {
        setHasOverflow(false);
        setShowLeftFade(false);
        setShowRightFade(false);
        return;
      }
      const { scrollWidth, clientWidth, scrollLeft } = node;
      const overflow = scrollWidth > clientWidth + 5;
      setHasOverflow(overflow);
      setShowLeftFade(scrollLeft > 10);
      setShowRightFade(scrollLeft + clientWidth < scrollWidth - 10);
    };
    // update on next tick (after render)
    const t = setTimeout(update, 50);
    window.addEventListener('resize', update);
    if (el) el.addEventListener('scroll', update);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', update);
      if (el) el.removeEventListener('scroll', update);
    };
  }, [recommended]);

  if (loading) return <div className="text-center p-10">Cargando evento...</div>;
  if (!evento) return <div className="text-center p-10">Evento no encontrado.</div>;

  // Build date/time from separate fecha (DateOnly) and hora (HH:mm) to avoid timezone shifts
  const buildDateTime = (fecha?: string, hora?: string | null) => {
    if (!fecha) return new Date();
    const [y, m, d] = fecha.split('-').map(Number);
    if (hora) {
      const [hh, mm] = hora.split(':').map(Number);
      return new Date(y, m - 1, d, hh ?? 0, mm ?? 0);
    }
    return new Date(y, m - 1, d);
  };

  const eventDate = buildDateTime(evento.fecha, evento.hora);
  const formattedDate = eventDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedTime = evento.hora ?? eventDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <img src={evento.posterUrl} alt={evento.nombre} className="rounded-lg shadow-2xl w-full object-cover" />
        </div>
        <div className="md:col-span-2">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">{evento.nombre}</h1>
          <p className="text-lg text-gray-300 mb-6">{evento.descripcion}</p>
          
          <div className="bg-base-200/50 p-6 rounded-lg mb-6 space-y-4">
            <div className="flex items-center text-lg">
                <CalendarIcon className="w-6 h-6 mr-3 text-primary"/>
                <span>{formattedDate} a las {formattedTime}</span>
            </div>
            <div className="flex items-center text-lg">
                <MapPinIcon className="w-6 h-6 mr-3 text-primary"/>
                <span className="text-white">{evento.ubicacion || 'Ubicación no disponible'}</span>
            </div>

            {zonasAvailability && zonasAvailability.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2">Entradas disponibles por zona</h3>
                <ul className="space-y-2 text-sm">
                  {zonasAvailability.map(z => (
                    <li key={z.id} className="flex justify-between items-center bg-base-300 p-2 rounded">
                      <div>
                        <div className="font-medium">{z.nombre}</div>
                        <div className="text-xs text-gray-400">Precio: ${Number(z.precio ?? 0).toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{z.available}</div>
                        <div className="text-xs text-gray-400">de {z.total}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-8">
             <Link to={`/evento/${id}/asientos`}>
                <Button size="lg" variant="primary" className="w-full md:w-auto shadow-lg hover:shadow-primary/50 transform hover:scale-105">
                    Comprar Entradas
                </Button>
            </Link>
          </div>
        </div>
      </div>

      {recommended && recommended.length > 0 && (
        <div className="container mx-auto px-4 py-8 relative">
          <h2 className="text-2xl font-bold text-white mb-4">Eventos recomendados</h2>
          <div className="relative">
            {hasOverflow && (
            <button
              aria-label="Anterior"
              onClick={() => {
                if (carouselRef.current) carouselRef.current.scrollBy({ left: -300, behavior: 'smooth' });
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20"
            >
              <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 py-2 rounded-full shadow-lg">
                <span className="hidden md:inline">Anterior</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.293 15.293a1 1 0 010-1.414L15.586 10 12.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
              </div>
            </button>
            )}

            <div className="relative">
              <div ref={carouselRef} className="flex gap-4 overflow-x-auto hide-scrollbar py-2 px-8">
                {recommended.map(ev => (
                  <div key={ev.id} className="min-w-[300px]">
                    <Link to={`/evento/${ev.id}`}>
                      <EventCard event={ev} square />
                    </Link>
                  </div>
                ))}
              </div>
              {showLeftFade && (
                <div className="absolute left-0 top-0 bottom-0 w-28 pointer-events-none bg-base-200" style={{WebkitMaskImage: 'linear-gradient(90deg, rgba(0,0,0,1), rgba(0,0,0,0))', maskImage: 'linear-gradient(90deg, rgba(0,0,0,1), rgba(0,0,0,0))'}} />
              )}
              {showRightFade && (
                <div className="absolute right-0 top-0 bottom-0 w-28 pointer-events-none bg-base-200" style={{WebkitMaskImage: 'linear-gradient(270deg, rgba(0,0,0,1), rgba(0,0,0,0))', maskImage: 'linear-gradient(270deg, rgba(0,0,0,1), rgba(0,0,0,0))'}} />
              )}
            </div>

            {hasOverflow && (
            <button
              aria-label="Siguiente"
              onClick={() => {
                if (carouselRef.current) carouselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20"
            >
              <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 py-2 rounded-full shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-180" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.293 15.293a1 1 0 010-1.414L15.586 10 12.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
                <span className="hidden md:inline">Siguiente</span>
              </div>
            </button>
            )}
          </div>
          <style>{`.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } .hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
        </div>
      )}
    </div>
  );
};
