import keycloak from './keycloakService';

const BASE_URL = import.meta.env.VITE_NOTIFICATIONS_API_URL || 'http://localhost:5299/api/notifications';

async function request<T>(path: string, method = 'POST', body?: any): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    await keycloak.ensureTokenValid(30);
  } catch {}
  const token = keycloak.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export default {
  sendSurveyInvitation: (payload: {
    to: string;
    nombreUsuario: string;
    enlaceEncuesta: string;
  }) => request('/send-survey-invitation', 'POST', payload),

  sendNewEventNotification: (payload: {
    to: string;
    nombreUsuario: string;
    nombreEvento: string;
    fechaEvento: string;
    lugarEvento: string;
    descripcionEvento: string;
    enlaceEvento: string;
  }) => request('/send-new-event', 'POST', payload),

  sendTicketConfirmation: (payload: {
    to: string;
    nombreUsuario: string;
    nombreEvento: string;
    fechaEvento: string;
    lugarEvento: string;
    cantidadEntradas: number;
    asientos: string;
    montoTotal: string;
    codigoCompra: string;
  }) => request('/send-ticket-confirmation', 'POST', payload),

  sendGeneralEmail: (payload: {
    to: string;
    subject: string;
    body: string;
  }) => request('/send-general-email', 'POST', payload),
};

// KPIs y métricas para dashboard
export async function getTicketStats() {
  // Simulación: reemplaza con endpoint real
  return {
    sent: 120,
    failed: 3,
    pending: 5,
  };
}

export async function getEventStats() {
  // Simulación: reemplaza con endpoint real
  return {
    surveysResponded: 80,
    surveysTotal: 100,
    emailsSent: 200,
    eventsPublished: 15,
  };
}
