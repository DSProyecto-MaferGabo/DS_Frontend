import React from 'react';
import { useKeycloak } from '../hooks/useKeycloak';
import { joinUserChannel, registerSurveyInvitationHandler, type SurveyInvitationPayload } from '../services/notificationHubClient';

type InvitationNotice = {
  invitationId?: number;
  eventId?: number;
  surveyUrl?: string;
  message?: string;
};

const normalizePayload = (payload: SurveyInvitationPayload): InvitationNotice => {
  const meta = payload?.metadata || {};
  const invitationId = Number(payload?.invitationId ?? meta['invitationId'] ?? meta['InvitationId'] ?? meta['id'] ?? 0) || undefined;
  const eventId = Number(payload?.eventId ?? meta['eventId'] ?? meta['EventId'] ?? meta['eventoId'] ?? 0) || undefined;
  const surveyUrl = (payload?.surveyUrl || meta['surveyUrl'] || meta['link'] || meta['url']) as string | undefined;
  const message = (payload?.message || meta['message'] || meta['mensaje'] || '') as string | undefined;
  return { invitationId, eventId, surveyUrl, message };
};

export const SurveyInvitationListener: React.FC = () => {
  const { authenticated, profile } = useKeycloak();
  const [notice, setNotice] = React.useState<InvitationNotice | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    let unsub: (() => void) | null = null;
    if (!authenticated || !profile?.id) return;

    joinUserChannel(profile.id).catch((err) => console.warn('[SurveyInvitationListener] join user channel failed', err));

    registerSurveyInvitationHandler((payload) => {
      const normalized = normalizePayload(payload);
      setNotice(normalized);
      setVisible(true);
    })
      .then((fn) => {
        unsub = fn;
      })
      .catch((err) => console.warn('[SurveyInvitationListener] register handler failed', err));

    return () => {
      unsub?.();
    };
  }, [authenticated, profile?.id]);

  if (!visible || !notice) return null;

  const handleDismiss = () => setVisible(false);
  const handleOpenSurvey = () => {
    if (notice.surveyUrl) {
      window.open(notice.surveyUrl, '_blank', 'noopener');
    } else {
      alert('Encuesta pendiente. Revisa tu correo para el enlace de la encuesta.');
    }
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full">
      <div className="bg-base-200 border border-primary/40 shadow-xl rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">✉️</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Nueva encuesta pendiente</p>
            <p className="text-xs text-gray-300 mt-1">
              {notice.message || 'Responde la encuesta para compartir tu experiencia del evento.'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {notice.eventId ? `Evento #${notice.eventId}` : 'Encuesta de evento'}
              {notice.invitationId ? ` • Invitación #${notice.invitationId}` : ''}
            </p>
            <div className="mt-3 flex gap-2">
              <button className="btn btn-sm btn-primary" onClick={handleOpenSurvey}>
                Responder ahora
              </button>
              <button className="btn btn-sm btn-outline" onClick={handleDismiss}>
                Después
              </button>
            </div>
          </div>
          <button className="btn btn-ghost btn-xs" onClick={handleDismiss}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default SurveyInvitationListener;
