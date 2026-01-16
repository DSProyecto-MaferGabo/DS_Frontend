import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import eventsApi from '../../services/eventsApi';
import reservationsApi from '../../services/reservationsApi';
import mediaApi, { MediaFileRecord } from '../../services/mediaApi';
import type { Evento, EventFormat } from '../../types';
import { Button } from '../../components/ui/Button';
import { useKeycloak } from '../../hooks/useKeycloak';
import { CalendarIcon, MapPinIcon } from '@heroicons/react/24/solid';
import { EventCard } from '../../components/EventCard';
import supportApi from '../../services/supportApi';

const FORMAT_LABELS: Record<EventFormat, string> = {
  presencial: 'Evento presencial',
  streaming: 'Evento en streaming',
  hibrido: 'Evento híbrido',
};

const POSTER_FALLBACK = 'https://picsum.photos/seed/ds-detail/960/640';
const MEDIA_PUBLIC_BASE = import.meta.env.VITE_MEDIA_PUBLIC_BASE_URL || '';

const FORMAT_BADGE_CLASSES: Record<EventFormat, string> = {
  presencial: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30',
  streaming: 'bg-indigo-500/15 text-indigo-200 border border-indigo-400/30',
  hibrido: 'bg-amber-500/15 text-amber-200 border border-amber-400/30',
};

const isStreamingFormat = (format: EventFormat) => format === 'streaming' || format === 'hibrido';

const buildStreamingEmbedUrl = (raw?: string | null) => {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '').trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/embed/')) return raw;
      const videoId = parsed.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments[0] === 'live' && segments[1]) {
        return `https://www.youtube.com/embed/${segments[1]}`;
      }
    }
  } catch {
    return null;
  }
  return null;
};

const resolveAssetUrl = (asset: MediaFileRecord | null) => {
  if (!asset) return null;
  const candidate = asset.publicUrl ?? (asset as any)?.url ?? null;
  if (!candidate) return null;
  if (/^https?:\/\//i.test(candidate)) return candidate;
  if (MEDIA_PUBLIC_BASE) return `${MEDIA_PUBLIC_BASE.replace(/\/+$/, '')}/${candidate.replace(/^\/+/, '')}`;
  return candidate;
};

const resolveAssetName = (asset: MediaFileRecord | null, fallback: string) => {
  if (!asset) return fallback;
  return asset.originalFileName ?? (asset as any)?.OriginalFileName ?? fallback;
};

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
  const [programAsset, setProgramAsset] = useState<MediaFileRecord | null>(null);
  const [receiptAsset, setReceiptAsset] = useState<MediaFileRecord | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSending, setReportSending] = useState(false);
  const [signedLink, setSignedLink] = useState<string | null>(null);

  const { profile, authenticated } = useKeycloak();
  const [hasTicket, setHasTicket] = useState<boolean>(false);
  const [simulatedStreaming, setSimulatedStreaming] = useState<boolean>(false);

  const canReport = authenticated && !!profile && !!evento?.ownerId;

  const submitReport = async () => {
    if (!evento?.ownerId || !id) return;
    setReportSending(true);
    setReportError(null);
    try {
      await supportApi.createTicket({
        eventId: Number(id),
        organizerUserId: Number(evento.ownerId),
        title: reportTitle || `Problema con evento #${id}`,
        description: reportDesc || 'Problema reportado por el cliente.'
      });
      setReportModalOpen(false);
      setReportTitle('');
      setReportDesc('');
    } catch (e) {
      console.error('No se pudo enviar el ticket', e);
      setReportError('No se pudo enviar el ticket de soporte.');
    } finally {
      setReportSending(false);
    }
  };

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
                const sid = String(s.rawId ?? s.id ?? s.ID ?? '');
                if (reservedSeatIds.has(sid)) reserved++;
              });
              return { id: z.id, nombre: z.nombre, precio: z.precio ?? z.price, total, available: Math.max(0, total - reserved) };
            });

            // Also determine whether the current authenticated user has a confirmed reservation (ticket)
            try {
              if (authenticated && profile?.id) {
                const myRes = await reservationsApi.getReservations(profile.id).catch(() => []);
                const hasConfirmed = (myRes || []).some((r:any) => {
                  const evId = Number(r.eventoId ?? r.evento ?? r.EventoId ?? 0);
                  const estado = String(r.estado ?? r.State ?? r.state ?? '').toLowerCase();
                  const paidStates = ['confirmada','confirmado','paid','pagada','pagado','completada','completado','completed','confirmed'];
                  return evId === Number(id) && paidStates.includes(estado);
                });
                setHasTicket(hasConfirmed);
              }
            } catch (e) {
              console.warn('Could not determine user reservations for streaming entitlement', e);
            }

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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const loadAssets = async () => {
      // si el endpoint requiere auth, evita 401 si no hay token
      try { await keycloak.ensureTokenValid(10); } catch {}
      const hasToken = !!keycloak.getToken();
      if (!hasToken) {
        setProgramAsset(null);
        setReceiptAsset(null);
        return;
      }
      setMediaLoading(true);
      try {
        const [programFiles, receiptFiles] = await Promise.all([
          mediaApi.getEventFiles(Number(id), 'program').catch(() => []),
          mediaApi.getEventFiles(Number(id), 'payment-receipt').catch(() => []),
        ]);
        if (!cancelled) {
          setProgramAsset((programFiles || [])[0] ?? null);
          setReceiptAsset((receiptFiles || [])[0] ?? null);
        }
      } catch (err) {
        console.warn('No se pudieron obtener archivos descargables del evento', err);
        if (!cancelled) {
          setProgramAsset(null);
          setReceiptAsset(null);
        }
      } finally {
        if (!cancelled) {
          setMediaLoading(false);
        }
      }
    };
    loadAssets();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    reservationsApi.trackEventView(Number(id)).catch(err => {
      console.warn('No se pudo registrar la vista del evento', err);
    });
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
  const eventFormat = ((evento as any).eventFormat ?? 'presencial') as EventFormat;
  const streamingUrl = String((evento as any).streamingUrl ?? '').trim();
  const streamingEmbedUrl = buildStreamingEmbedUrl(streamingUrl);
  const streamingReady = isStreamingFormat(eventFormat);
  const streamingPrice = Number((evento as any).generalPrice ?? 0) || 0;
  const posterSrc = (() => {
    const poster = (evento as any).posterUrl || (evento as any).PosterUrl || (evento as any).poster || '';
    if (poster && /^https?:\/\//i.test(poster)) return poster;
    if (poster && MEDIA_PUBLIC_BASE) return `${MEDIA_PUBLIC_BASE.replace(/\/+$/, '')}/${poster.replace(/^\/+/, '')}`;
    return POSTER_FALLBACK;
  })();
  const programUrl = resolveAssetUrl(programAsset);
  const receiptUrl = resolveAssetUrl(receiptAsset);
  const hasDownloads = Boolean(programAsset || receiptAsset || mediaLoading);
  const generateSignedStreamingUrl = () => {
    if (!streamingUrl || !hasTicket) {
      setSignedLink(null);
      return;
    }
    const exp = Date.now() + 30 * 60 * 1000; // 30 minutos
    const payload = `${streamingUrl}|${profile?.id ?? 'user'}|${exp}`;
    const token = btoa(payload).replace(/=+$/,'');
    const link = `${streamingUrl}${streamingUrl.includes('?') ? '&' : '?'}token=${token}&exp=${exp}`;
    setSignedLink(link);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <img src={posterSrc} alt={evento.nombre} className="rounded-lg shadow-2xl w-full object-cover" />
        </div>
        <div className="md:col-span-2">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">{evento.nombre}</h1>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className={`text-xs tracking-wide uppercase font-semibold px-3 py-1 rounded-full ${FORMAT_BADGE_CLASSES[eventFormat]}`}>
              {FORMAT_LABELS[eventFormat]}
            </span>
            {streamingReady && (
              <span className="text-xs text-gray-400">
                {streamingUrl ? 'Disponible también en línea' : 'El organizador compartirá el enlace en breve'}
              </span>
            )}
          </div>
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

            {streamingReady && (
              <div className="pt-4 border-t border-base-300">
                <h3 className="font-semibold mb-2">Streaming en vivo</h3>
                    {/* Streaming should only be visible to users who purchased a ticket and when the event time has arrived; allow simulation via a button */}
                {((new Date() >= eventDate && hasTicket) || simulatedStreaming) ? (
                  streamingEmbedUrl ? (
                    <div className="aspect-video w-full rounded-lg overflow-hidden border border-base-300">
                      <iframe
                        src={streamingEmbedUrl}
                        title={`Streaming de ${evento.nombre}`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : streamingUrl ? (
                    <a
                      href={streamingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center px-4 py-2 mt-1 bg-primary/20 text-white rounded hover:bg-primary/30 transition"
                    >
                      Abrir transmisión en una pestaña nueva
                    </a>
                  ) : (
                    <p className="text-sm text-gray-400">Muy pronto compartiremos el enlace de streaming para este evento.</p>
                  )
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-gray-400">El streaming estará disponible a la hora del evento para usuarios con entrada.</p>
                    {/* Show simulate button if user has ticket */}
                    {hasTicket ? (
                      <button className="btn btn-outline btn-sm" onClick={() => setSimulatedStreaming(true)}>
                        Simular streaming ahora
                      </button>
                    ) : (
                      <button className="btn btn-outline btn-sm" disabled title="Debes comprar una entrada para ver el streaming">
                        Simular streaming (requiere entrada)
                      </button>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">Comparte el enlace solo con personas autorizadas.</p>
                {hasTicket && streamingUrl && (
                  <div className="mt-3 space-y-2">
                    <button className="btn btn-outline btn-sm" onClick={generateSignedStreamingUrl}>
                      Generar enlace seguro (firma 30 min)
                    </button>
                    {signedLink && (
                      <div className="text-xs text-gray-300 break-all bg-base-300/60 p-2 rounded border border-base-300">
                        {signedLink}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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

            {hasDownloads && (
              <div className="mt-6">
                <h3 className="font-semibold mb-2">Material descargable</h3>
                {mediaLoading && !programAsset && !receiptAsset ? (
                  <p className="text-sm text-gray-400">Buscando archivos compartidos por el organizador...</p>
                ) : (
                  <div className="space-y-3">
                    {programAsset && (
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-base-300/60 border border-base-300 rounded-lg p-4">
                        <div>
                          <p className="text-sm text-gray-400 uppercase tracking-wide">Programa oficial</p>
                          <p className="font-semibold">{resolveAssetName(programAsset, 'programa.pdf')}</p>
                        </div>
                        {programUrl && (
                          <a
                            href={programUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center px-4 py-2 rounded bg-primary/80 hover:bg-primary text-white text-sm transition"
                          >
                            Descargar PDF
                          </a>
                        )}
                      </div>
                    )}

                    {receiptAsset && (
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-base-300/60 border border-base-300 rounded-lg p-4">
                        <div>
                          <p className="text-sm text-gray-400 uppercase tracking-wide">Comprobante de pago</p>
                          <p className="font-semibold">{resolveAssetName(receiptAsset, 'comprobante')}</p>
                        </div>
                        {receiptUrl && (
                          <a
                            href={receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center px-4 py-2 rounded bg-primary/80 hover:bg-primary text-white text-sm transition"
                          >
                            Descargar archivo
                          </a>
                        )}
                      </div>
                    )}

                    {!programAsset && !receiptAsset && (
                      <p className="text-sm text-gray-400">El organizador aún no ha compartido archivos descargables.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-8">
            {eventFormat === 'streaming' ? (
              <Link
                to="/payment"
                state={{
                  selectedSeats: [],
                  evento,
                  zonasMap: {},
                  selectedServiceIds: [],
                  selectedServices: [],
                  subtotal: streamingPrice,
                  servicesTotal: 0,
                  total: streamingPrice,
                  streamingPrice,
                }}
              >
                <Button
                  size="lg"
                  variant="primary"
                  className="w-full md:w-auto shadow-lg hover:shadow-primary/50 transform hover:scale-105"
                >
                  Comprar Entrada (Streaming)
                </Button>
              </Link>
            ) : (
              <Link to={`/evento/${id}/asientos`}>
                <Button
                  size="lg"
                  variant="primary"
                  className="w-full md:w-auto shadow-lg hover:shadow-primary/50 transform hover:scale-105"
                >
                  Comprar Entradas
                </Button>
              </Link>
            )}
            <Link to={`/evento/${id}/foro`}>
              <Button size="lg" variant="secondary" className="w-full md:w-auto mt-4 md:mt-0 md:ml-4">
                Abrir foro en vivo
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Reportar problema */}
      {canReport && (
        <div className="mt-6">
          <Button variant="secondary" onClick={() => setReportModalOpen(true)}>
            Reportar problema / Contactar soporte
          </Button>
        </div>
      )}

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
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-base-200 rounded-lg p-6 w-full max-w-lg space-y-4 border border-base-300">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Reportar problema</h3>
              <button className="text-gray-400 hover:text-white" onClick={() => setReportModalOpen(false)}>✕</button>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-300">Título</label>
              <input
                className="w-full bg-base-300 text-white px-3 py-2 rounded border border-base-400"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="Ej. No pude descargar mis entradas"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-300">Descripción</label>
              <textarea
                className="w-full bg-base-300 text-white px-3 py-2 rounded border border-base-400"
                rows={4}
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                placeholder="Describe el problema: pago fallido, acceso a streaming, etc."
              />
            </div>
            {reportError && <div className="text-red-400 text-sm">{reportError}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReportModalOpen(false)}>Cancelar</Button>
              <Button variant="primary" disabled={reportSending} onClick={submitReport}>
                {reportSending ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
