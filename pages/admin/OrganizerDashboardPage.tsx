import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import surveysApi from '../../services/surveysApi';
import notificationsApi from '../../services/notificationsApi';
import { t } from '../../i18n';
import eventsApi from '../../services/eventsApi';
import type { Evento, EventRequest, EventFormat } from '../../types';
import { useKeycloak } from '../../hooks/useKeycloak';

interface OrganizerEvent extends Evento {
  isPublished?: boolean | null;
  isCancelled?: boolean | null;
  state?: string | null;
  _inferredPublished?: boolean | null;
}

export const OrganizerDashboardPage = () => {
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<EventRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [stages, setStages] = useState<{ id: number; name: string; location?: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', date: '', time: '', stageId: '', categoryId: '', eventFormat: 'presencial' as EventFormat, streamingUrl: '' });
  const { permissions, userRecord } = useKeycloak();
  const privilegeList = permissions?.privileges || [];
  // Indicadores de encuestas y tickets
  const [surveyStats, setSurveyStats] = useState<any>(null);
  const [ticketStats, setTicketStats] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        // Solo cargar si hay eventos
        if (events.length > 0) {
          const surveySummary = await surveysApi.getInvitations(events[0].id);
          setSurveyStats(surveySummary);
        }
        const ticket = await notificationsApi.getTicketStats?.();
        setTicketStats(ticket);
      } catch {}
    })();
  }, [events]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await eventsApi.getMyEvents();
        if (!mounted) return;
        setEvents((data as OrganizerEvent[]) || []);
      } catch (err) {
        console.error('[OrganizerDashboard] failed to load events', err);
        if (!mounted) return;
        setError('No se pudieron obtener tus eventos. Intenta nuevamente.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoadingRequests(true);
      setRequestError(null);
      try {
        const [reqs, stageList, catList] = await Promise.all([
          eventsApi.getMyEventRequests(),
          eventsApi.getStages(),
          eventsApi.getCategories().catch(() => []),
        ]);
        if (!mounted) return;
        
        // Filter stages and categories to only those used in organizer's events
        const myEventStageIds = new Set(events.map(e => e.stageId));
        const myEventCategoryIds = new Set(events.map(e => e.categoryId).filter(id => id));
        
        const filteredStages = (stageList || []).filter((s: any) => myEventStageIds.has(s.id ?? s.Id));
        const filteredCategories = (catList || []).filter((c: any) => myEventCategoryIds.has(c.id ?? c.Id));
        
        setRequests(reqs || []);
        setStages(filteredStages.map((s: any) => ({ id: s.id ?? s.Id, name: s.name ?? s.Name ?? `Escenario ${s.id}`, location: s.location ?? s.Location })));
        setCategories(filteredCategories.map((c: any) => ({ id: c.id, name: c.name })));
      } catch (err) {
        console.error('[OrganizerDashboard] failed to load requests', err);
        if (!mounted) return;
        setRequestError('No pudimos obtener tus solicitudes.');
      } finally {
        if (mounted) setIsLoadingRequests(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [events]); // Depend on events so it re-runs when events are loaded

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const needsStreamingUrl = form.eventFormat !== 'presencial';
    if (!form.name || !form.description || !form.date || !form.stageId) {
      setRequestError('Completa al menos nombre, descripción, fecha y escenario.');
      return;
    }
    if (needsStreamingUrl && !form.streamingUrl.trim()) {
      setRequestError('Proporciona el enlace de streaming para eventos streaming o híbridos.');
      return;
    }
    setIsSubmitting(true);
    setRequestError(null);
    try {
      await eventsApi.createEventRequest({
        name: form.name,
        description: form.description,
        date: form.date,
        time: form.time || null,
        stageId: Number(form.stageId),
        categoryId: form.categoryId ? Number(form.categoryId) : undefined,
        eventFormat: form.eventFormat,
        streamingUrl: form.streamingUrl || undefined,
      });
      const refreshed = await eventsApi.getMyEventRequests();
      setRequests(refreshed || []);
      setForm({ name: '', description: '', date: '', time: '', stageId: '', categoryId: '', eventFormat: 'presencial', streamingUrl: '' });
    } catch (err) {
      console.error('[OrganizerDashboard] create request error', err);
      setRequestError('No se pudo registrar la solicitud. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const publishedCount = events.filter((evt) => (evt.isPublished ?? evt._inferredPublished) === true).length;
  const draftCount = events.length - publishedCount;
  const cancelledCount = events.filter((evt) => evt.isCancelled).length;

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-primary">Panel del Organizador</p>
          <h1 className="text-3xl font-semibold text-white">Tus eventos y acciones rápidas</h1>
          <p className="text-gray-400 mt-1">Consulta el estado de tus eventos y crea nuevos desde un solo lugar.</p>
        </div>
        <div className="flex gap-4">
          <Link to="/admin/eventos/solicitar" className="btn btn-primary">Solicitar Evento</Link>
          <Link to="/admin/eventos" className="btn btn-outline">Gestionar eventos</Link>
          <Link to="/admin/foros" className="btn btn-outline">Ver foros</Link>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <DashboardStat label="Publicados" value={publishedCount} accent="text-green-400" />
        <DashboardStat label="Borradores" value={draftCount} accent="text-yellow-300" />
        <DashboardStat label="Cancelados" value={cancelledCount} accent="text-red-400" />
        <div className="bg-base-200 rounded-xl p-6 border border-base-300 shadow-lg flex flex-col gap-2">
          <span className="text-sm uppercase tracking-wider text-gray-400">Encuestas</span>
          <span className="text-2xl font-bold text-blue-300">{surveyStats ? surveyStats.responded + '/' + surveyStats.total : '--'}</span>
          <Link to="/admin/survey-invitations" className="btn btn-xs btn-outline mt-2">Ver invitaciones</Link>
        </div>
        <div className="bg-base-200 rounded-xl p-6 border border-base-300 shadow-lg flex flex-col gap-2">
          <span className="text-sm uppercase tracking-wider text-gray-400">Tickets</span>
          <span className="text-2xl font-bold text-emerald-300">{ticketStats ? ticketStats.sent : '--'}</span>
          <Link to="#" className="btn btn-xs btn-outline mt-2">Ver tickets</Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-base-200 rounded-xl border border-base-300 shadow-lg">
          <div className="p-6 border-b border-base-300 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Solicitar publicación de evento</h2>
            <span className="text-xs text-gray-400">Se envía a revisión de admin/soporte</span>
          </div>
          <div className="p-6">
            <p className="text-gray-400 mb-4">
              Para solicitar la publicación de un evento, necesitas proporcionar toda la información completa incluyendo zonas, precios, asientos y archivos adjuntos.
            </p>
            <Link to="/admin/eventos/solicitar" className="btn btn-primary">
              Ir al formulario completo de solicitud
            </Link>
          </div>
        </div>

        <div className="bg-base-200 rounded-xl border border-base-300 shadow-lg">
          <div className="p-6 border-b border-base-300 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Estado de solicitudes</h2>
            <span className="text-sm text-gray-400">{requests.length} registro(s)</span>
          </div>
          {isLoadingRequests ? (
            <div className="p-6 text-gray-400">Cargando solicitudes...</div>
          ) : requestError ? (
            <div className="p-6 text-red-400">{requestError}</div>
          ) : requests.length === 0 ? (
            <div className="p-6 text-gray-400">Aún no has enviado solicitudes.</div>
          ) : (
            <ul className="divide-y divide-base-300">
              {requests.map((req) => (
                <li key={req.id} className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-white font-semibold">{req.name}</p>
                      <p className="text-xs text-gray-400">{req.date}{req.time ? ` · ${req.time}` : ''}</p>
                    </div>
                    <RequestStatusPill status={req.status} />
                  </div>
                  <p className="text-sm text-gray-300 line-clamp-2">{req.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-base-200 rounded-xl shadow-lg border border-base-300">
        <div className="p-6 border-b border-base-300 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Mis eventos</h2>
          <span className="text-sm text-gray-400">{events.length} registro(s)</span>
        </div>
        {isLoading ? (
          <div className="p-6 text-gray-400">Cargando eventos...</div>
        ) : error ? (
          <div className="p-6 text-red-400">{error}</div>
        ) : events.length === 0 ? (
          <div className="p-6 text-gray-400">
            Aún no tienes eventos. Usa el botón "Crear evento" para publicar el primero.
          </div>
        ) : (
          <ul className="divide-y divide-base-300">
            {events.map((evt) => (
              <li key={evt.id} className="p-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-semibold text-white">{evt.nombre}</p>
                  <p className="text-sm text-gray-400">{evt.fecha} · {evt.ubicacion || 'Por definir'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill event={evt} />
                  <Link to={`/admin/eventos/${evt.id}/editar`} className="btn btn-sm btn-outline">Editar</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

const DashboardStat = ({ label, value, accent }: { label: string; value: number; accent: string }) => (
  <div className="bg-base-200 rounded-xl p-6 border border-base-300 shadow-lg">
    <p className="text-sm uppercase tracking-wider text-gray-400">{label}</p>
    <p className={`text-4xl font-bold mt-2 ${accent}`}>{value}</p>
  </div>
);

const StatusPill = ({ event }: { event: OrganizerEvent }) => {
  const isCancelled = !!event.isCancelled;
  const isPublished = (event.isPublished ?? event._inferredPublished) === true;
  const label = isCancelled ? 'Cancelado' : isPublished ? 'Publicado' : 'Borrador';
  const color = isCancelled ? 'bg-red-500/20 text-red-300' : isPublished ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-200';
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>{label}</span>;
};

const RequestStatusPill = ({ status }: { status: string }) => {
  const normalized = (status || '').toLowerCase();
  let label = status;
  let color = 'bg-gray-500/20 text-gray-200';
  if (normalized.includes('pendingadmin') || normalized.includes('pending')) {
    label = 'Pendiente de aprobación';
    color = 'bg-yellow-500/20 text-yellow-200';
  }
  if (normalized.includes('approved')) {
    label = 'Aprobado · pago/publicación en curso';
    color = 'bg-blue-500/20 text-blue-200';
  }
  if (normalized.includes('rejected')) {
    label = 'Rechazado';
    color = 'bg-red-500/20 text-red-200';
  }
  if (normalized.includes('completed')) {
    label = 'Publicado (pago aplicado)';
    color = 'bg-green-500/20 text-green-200';
  }
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>{label}</span>;
};

export default OrganizerDashboardPage;
