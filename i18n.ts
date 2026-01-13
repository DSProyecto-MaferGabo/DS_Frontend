// Simple i18n mock. Replace with real i18n solution as needed.
export const availableLanguages = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
];

let currentLanguage = 'es';

export function setLanguage(lang: string) {
  if (availableLanguages.some(l => l.code === lang)) {
    currentLanguage = lang;
  }
}

export function getLanguage() {
  return currentLanguage;
}

const dicts: Record<string, Record<string, string>> = {
  es: {
    'survey.title': 'Seguimiento de Encuestas Post-Evento',
    'survey.subtitle': 'Verifica qué asistentes recibieron la invitación y quiénes ya respondieron.',
    'survey.selectEvent': 'Selecciona un evento',
    'survey.loadingEvents': 'Cargando eventos...',
    'survey.noEvents': 'Aún no tienes eventos publicados.',
    'survey.loadingInvitations': 'Cargando invitaciones...',
    'survey.invitations': 'Invitaciones',
    'survey.notified': 'Notificadas',
    'survey.responded': 'Respondidas',
    'survey.pending': 'Pendientes',
    'survey.sentInvitations': 'Invitaciones enviadas',
    'survey.lastUpdate': 'Última actualización',
    'survey.resendAll': 'Generar/Reenviar todas',
    'survey.resendPending': 'Re-notificar pendientes',
    'survey.user': 'Usuario',
    'survey.status': 'Estado',
    'survey.notifiedAt': 'Notificado',
    'survey.respondedAt': 'Respuesta',
    'survey.retries': 'Reintentos',
    'survey.resend': 'Re-notificar',
    'survey.filter': 'Filtrar asistentes...',
    'survey.eventFinalized': 'Evento finalizado',
    'survey.eventNotFinalized': 'Evento no finalizado',
    'survey.eventCancelled': 'Evento cancelado',
    'survey.progress': 'Progreso de respuestas',
    'survey.noInvitations': 'No hay invitaciones para mostrar.',
    'date.format': 'DD/MM/YYYY',
    'price.format': '{value} €',
  },
  en: {
    'survey.title': 'Post-Event Survey Tracking',
    'survey.subtitle': 'Check which attendees received the invitation and who has already responded.',
    'survey.selectEvent': 'Select an event',
    'survey.loadingEvents': 'Loading events...',
    'survey.noEvents': 'You have no published events yet.',
    'survey.loadingInvitations': 'Loading invitations...',
    'survey.invitations': 'Invitations',
    'survey.notified': 'Notified',
    'survey.responded': 'Responded',
    'survey.pending': 'Pending',
    'survey.sentInvitations': 'Sent invitations',
    'survey.lastUpdate': 'Last update',
    'survey.resendAll': 'Regenerate/Resend all',
    'survey.resendPending': 'Re-notify pending',
    'survey.user': 'User',
    'survey.status': 'Status',
    'survey.notifiedAt': 'Notified',
    'survey.respondedAt': 'Response',
    'survey.retries': 'Retries',
    'survey.resend': 'Re-notify',
    'survey.filter': 'Filter attendees...',
    'survey.eventFinalized': 'Event finalized',
    'survey.eventNotFinalized': 'Event not finalized',
    'survey.eventCancelled': 'Event canceled',
    'survey.progress': 'Response progress',
    'survey.noInvitations': 'No invitations to show.',
    'date.format': 'MM/DD/YYYY',
    'price.format': '${value}',
  },
};

export const t = (key: string, vars?: Record<string, string | number>) => {
  const dict = dicts[currentLanguage] || dicts['es'];
  let text = dict[key] || key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
};

export function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const lang = getLanguage();
  return lang === 'en'
    ? d.toLocaleDateString('en-US')
    : d.toLocaleDateString('es-ES');
}

export function formatPrice(value: number) {
  const lang = getLanguage();
  return lang === 'en'
    ? `$${value.toFixed(2)}`
    : `${value.toFixed(2)} €`;
}
