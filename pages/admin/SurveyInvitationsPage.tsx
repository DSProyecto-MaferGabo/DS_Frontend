
import React, { useEffect, useMemo, useState } from 'react';
import eventsApi from '../../services/eventsApi';
import surveysApi from '../../services/surveysApi';
import reservationsApi from '../../services/reservationsApi';
import { t } from '../../i18n';
import type { Evento, SurveyInvitation, SurveyInvitationSummary } from '../../types';
import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface FlashState {
  type: 'success' | 'error';
  message: string;
}

const statusStyles: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-300',
  NOTIFIED: 'bg-blue-500/20 text-blue-200',
  RESPONDED: 'bg-green-500/20 text-green-200',
};

export const SurveyInvitationsPage: React.FC = () => {
  const [events, setEvents] = useState<Evento[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [summary, setSummary] = useState<SurveyInvitationSummary | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [pendingAction, setPendingAction] = useState(false);
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [filter, setFilter] = useState('');
  const [confirmedUsers, setConfirmedUsers] = useState<Array<{ userId: string; email?: string }>>([]);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const data = await eventsApi.getMyEvents();
        const now = new Date();
        const finalized = (data || []).filter((evt: any) => {
          if (!evt?.fecha) return false;
          const evtDate = new Date(evt.fecha);
          return evtDate <= now && !evt.isCancelled;
        });
        setEvents(finalized);
        if (finalized.length > 0) {
          setSelectedEventId(finalized[0].id);
        }
      } catch (err) {
        console.error('Error loading events', err);
        setFlash({ type: 'error', message: 'No se pudieron cargar tus eventos.' });
      } finally {
        setLoadingEvents(false);
      }
    };

    loadEvents();
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      setSummary(null);
      return;
    }
    const loadSummary = async () => {
      setLoadingSummary(true);
      try {
        const data = await surveysApi.getInvitations(selectedEventId);
        setSummary(data);
        // fetch confirmed reservations for this event to list recipients
        try {
          const reservations = await reservationsApi.getReservations();
          const paidStates = ['confirmada','confirmado','paid','pagada','pagado','completada','completado','completed','confirmed'];
          const confirmed = (reservations || []).filter((r:any) => Number(r.eventoId ?? r.EventoId ?? r.eventId) === Number(selectedEventId)
            && paidStates.includes(String(r.estado ?? r.State ?? r.state ?? '').toLowerCase()))
            .map((r:any) => ({
              userId: r.usuarioId ?? r.usuario ?? r.userId ?? '',
              email: r.usuarioEmail ?? r.email ?? ''
            }))
            .filter((r:any) => r.userId || r.email);
          setConfirmedUsers(confirmed);
        } catch (err) {
          console.warn('No se pudieron cargar reservas confirmadas para el evento', err);
          setConfirmedUsers([]);
        }
      } catch (err) {
        console.error('Error loading invitations', err);
        setFlash({ type: 'error', message: 'No se pudieron obtener las invitaciones de encuestas.' });
      } finally {
        setLoadingSummary(false);
      }
    };

    loadSummary();
  }, [selectedEventId]);

  const pendingInvitations = useMemo(
    () => summary?.invitations.filter(inv => !inv.respondedAtUtc) ?? [],
    [summary]
  );

  const selectedEvent = useMemo(() => events.find(e => e.id === selectedEventId) || null, [events, selectedEventId]);
  const isFinalized = useMemo(() => {
    if (!selectedEvent) return false;
    // Considerar finalizado si la fecha es pasada o si hay un flag explícito
    const today = new Date();
    const eventDate = new Date(selectedEvent.fecha);
    return (selectedEvent.isPublished && !selectedEvent.isCancelled && eventDate <= today);
  }, [selectedEvent]);
  const isCancelled = selectedEvent?.isCancelled;

  const showFlash = (next: FlashState) => {
    setFlash(next);
    setTimeout(() => setFlash(null), 4500);
  };

  const handleResendSingle = async (invitation: SurveyInvitation) => {
    if (!selectedEventId) return;
    try {
      setPendingAction(true);
      await surveysApi.resendInvitation(selectedEventId, invitation.id);
      showFlash({ type: 'success', message: `Notificación reenviada a ${invitation.userId}` });
      const data = await surveysApi.getInvitations(selectedEventId);
      setSummary(data);
    } catch (err) {
      console.error('Error resending notification', err);
      showFlash({ type: 'error', message: 'No se pudo re-notificar al asistente.' });
    } finally {
      setPendingAction(false);
    }
  };

  const handleResendPending = async () => {
    if (!selectedEventId || pendingInvitations.length === 0) return;
    try {
      setPendingAction(true);
      await surveysApi.resendPending(selectedEventId);
      showFlash({ type: 'success', message: 'Se reenviaron las invitaciones pendientes.' });
      const data = await surveysApi.getInvitations(selectedEventId);
      setSummary(data);
    } catch (err) {
      console.error('Error resending pending invitations', err);
      showFlash({ type: 'error', message: 'No se pudieron re-notificar los asistentes pendientes.' });
    } finally {
      setPendingAction(false);
    }
  };

  const handleGenerateInvitations = async () => {
    if (!selectedEventId) return;
    try {
      setPendingAction(true);
      await surveysApi.generateInvitations(selectedEventId);
      showFlash({ type: 'success', message: 'Invitaciones generadas y notificadas.' });
      const data = await surveysApi.getInvitations(selectedEventId);
      setSummary(data);
    } catch (err) {
      console.error('Error generating invitations', err);
      showFlash({ type: 'error', message: 'No se pudieron generar las invitaciones.' });
    } finally {
      setPendingAction(false);
    }
  };

  const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white flex items-center gap-2">
          {t('survey.title')}
          {isFinalized && !isCancelled && (
            <span className="ml-2 px-2 py-1 rounded bg-green-900/40 text-green-300 text-xs flex items-center gap-1">
              <CheckCircleIcon className="w-4 h-4 inline" /> {t('survey.eventFinalized')}
            </span>
          )}
          {isCancelled && (
            <span className="ml-2 px-2 py-1 rounded bg-red-900/40 text-red-300 text-xs flex items-center gap-1">
              <XCircleIcon className="w-4 h-4 inline" /> {t('survey.eventCancelled')}
            </span>
          )}
          {!isFinalized && !isCancelled && selectedEvent && (
            <span className="ml-2 px-2 py-1 rounded bg-yellow-900/40 text-yellow-300 text-xs flex items-center gap-1">
              <ExclamationTriangleIcon className="w-4 h-4 inline" /> {t('survey.eventNotFinalized')}
            </span>
          )}
        </h1>
        <p className="text-gray-400">{t('survey.subtitle')}</p>
      </div>

      {flash && (
        <div className={`rounded-lg px-4 py-3 flex items-center gap-2 ${flash.type === 'success' ? 'bg-emerald-900/40 text-emerald-200' : 'bg-rose-900/40 text-rose-200'}`}>
          {flash.type === 'success' ? <CheckCircleIcon className="w-5 h-5" /> : <XCircleIcon className="w-5 h-5" />}
          <span>{flash.message}</span>
        </div>
      )}

      <div className="bg-base-200 rounded-lg p-4 flex flex-col gap-3">
        <label className="text-sm text-gray-400">{t('survey.selectEvent')}</label>
        {loadingEvents ? (
          <span className="text-gray-400">{t('survey.loadingEvents')}</span>
        ) : events.length === 0 ? (
          <span className="text-gray-400">{t('survey.noEvents')}</span>
        ) : (
          <select
            value={selectedEventId ?? ''}
            onChange={(e) => setSelectedEventId(Number(e.target.value))}
            className="select select-bordered bg-base-100 text-white"
          >
            {events.map(evt => (
              <option key={evt.id} value={evt.id}>
                {evt.nombre} · {evt.fecha}
              </option>
            ))}
          </select>
        )}
      </div>

      {loadingSummary && (
        <div className="bg-base-200 rounded-lg p-6 text-gray-400">{t('survey.loadingInvitations')}</div>
      )}

      {!loadingSummary && summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard title={t('survey.invitations')} value={summary.total} subtitle="Totales" />
            <SummaryCard title={t('survey.notified')} value={summary.notified} subtitle="Con confirmación" color="text-blue-300" />
            <SummaryCard title={t('survey.responded')} value={summary.responded} subtitle="Encuestas completadas" color="text-green-300" />
            <SummaryCard title={t('survey.pending')} value={summary.pending} subtitle="Sin respuesta" color="text-yellow-300" />
          </div>

          {/* Barra de progreso de respuestas */}
          <div className="w-full my-4">
            <label className="text-sm text-gray-400 flex items-center gap-2">{t('survey.progress')}
              <span className="text-green-300 font-bold">{summary.total > 0 ? Math.round((summary.responded / summary.total) * 100) : 0}%</span>
            </label>
            <div className="w-full h-3 bg-base-300 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${summary.total > 0 ? (summary.responded / summary.total) * 100 : 0}%` }} />
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-semibold text-white">{t('survey.sentInvitations')}</h2>
              <p className="text-gray-400 text-sm">{t('survey.lastUpdate')}: {new Date().toLocaleTimeString()}</p>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-secondary"
                disabled={pendingAction || !isFinalized || isCancelled}
                onClick={handleGenerateInvitations}
              >
                {t('survey.resendAll')}
              </button>
              <button
                className="btn btn-primary"
                disabled={pendingInvitations.length === 0 || pendingAction || !isFinalized || isCancelled}
                onClick={handleResendPending}
              >
                {t('survey.resendPending')}
              </button>
            </div>
          </div>

          {/* Filtro de asistentes */}
          <div className="my-2 flex items-center gap-2">
            <input
              className="input input-bordered w-full max-w-xs"
              placeholder={t('survey.filter')}
              value={filter}
              onChange={e => setFilter(e.target.value)}
              disabled={summary.invitations.length === 0}
            />
          </div>

          <div className="overflow-x-auto bg-base-200 rounded-lg">
            <table className="table">
              <thead>
                <tr className="text-gray-400 text-sm">
                  <th>{t('survey.user')}</th>
                  <th>{t('survey.status')}</th>
                  <th>{t('survey.notifiedAt')}</th>
                  <th>{t('survey.respondedAt')}</th>
                  <th>{t('survey.retries')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {summary.invitations
                  .filter(inv =>
                    !filter || inv.userId.toLowerCase().includes(filter.toLowerCase())
                  )
                  .map(invitation => (
                    <tr key={invitation.id} className="border-base-300">
                      <td className="text-white font-mono">{invitation.userId}</td>
                      <td>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyles[invitation.status] || 'bg-gray-600/40 text-gray-200'}`}>
                          {invitation.status}
                        </span>
                      </td>
                      <td className="text-gray-300">{formatDate(invitation.notifiedAtUtc)}</td>
                      <td className="text-gray-300">{formatDate(invitation.respondedAtUtc)}</td>
                      <td className="text-gray-300">{invitation.notificationCount}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline"
                          disabled={!!invitation.respondedAtUtc || pendingAction || !isFinalized || isCancelled}
                          onClick={() => handleResendSingle(invitation)}
                        >
                          {t('survey.resend')}
                        </button>
                      </td>
                    </tr>
                  ))}
                {summary.invitations.filter(inv => !filter || inv.userId.toLowerCase().includes(filter.toLowerCase())).length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-400 py-4">{t('survey.noInvitations')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-base-200 rounded-lg p-4">
            <h2 className="text-xl font-semibold text-white mb-2">Usuarios con entrada confirmada</h2>
            <p className="text-sm text-gray-400 mb-3">Basado en reservas confirmadas para este evento. Si no han respondido, puedes reenviar.</p>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr className="text-gray-400 text-sm">
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Estado encuesta</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {confirmedUsers.map((u, idx) => {
                    const inv = summary.invitations.find(i => (i.userId ?? '').toLowerCase() === (u.userId ?? '').toLowerCase());
                    const responded = !!inv?.respondedAtUtc;
                    const status = inv?.status ?? 'PENDING';
                    return (
                      <tr key={`${u.userId}-${idx}`} className="border-base-300">
                        <td className="text-white font-mono">{u.userId || '—'}</td>
                        <td className="text-gray-300">{u.email || '—'}</td>
                        <td>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyles[status] || 'bg-gray-600/40 text-gray-200'}`}>
                            {responded ? 'RESPONDED' : status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline"
                            disabled={responded || pendingAction || !inv || !isFinalized || isCancelled}
                            onClick={() => inv && handleResendSingle(inv)}
                          >
                            Reenviar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {confirmedUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-gray-400 py-4">No se encontraron usuarios confirmados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const SummaryCard = ({ title, value, subtitle, color }: { title: string; value: number; subtitle?: string; color?: string }) => (
  <div className="bg-base-200 rounded-xl p-4 shadow">
    <div className="text-gray-400 text-sm">{title}</div>
    <div className={`text-3xl font-semibold text-white ${color ?? ''}`}>{value}</div>
    {subtitle && <div className="text-gray-500 text-sm">{subtitle}</div>}
  </div>
);

export default SurveyInvitationsPage;
