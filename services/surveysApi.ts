import keycloak from './keycloakService';
import type { SurveyInvitationSummary } from '../types';

const BASE_URL = import.meta.env.VITE_SURVEYS_API_URL || 'http://localhost:5098/api';

type Json = any;

async function request<T>(path: string, method = 'GET', body?: any): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    await keycloak.ensureTokenValid(30);
  } catch {
    // ignore, request may still succeed if endpoint is public
  }
  const token = keycloak.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const message = await res.text().catch(() => '');
    throw new Error(message || `HTTP ${res.status}`);
  }

  if (res.status === 204) return {} as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function normalizeSummary(raw: Json): SurveyInvitationSummary {
  const invitations = (raw.invitations || raw.Invitations || []).map((item: any) => ({
    id: item.id ?? item.Id,
    eventId: item.eventId ?? item.EventId,
    surveyId: item.surveyId ?? item.SurveyId ?? null,
    userId: item.userId ?? item.UserId ?? '',
    status: item.status ?? item.Status ?? 'PENDING',
    createdAtUtc: item.createdAtUtc ?? item.CreatedAtUtc ?? new Date().toISOString(),
    notifiedAtUtc: item.notifiedAtUtc ?? item.NotifiedAtUtc ?? null,
    respondedAtUtc: item.respondedAtUtc ?? item.RespondedAtUtc ?? null,
    notificationCount: item.notificationCount ?? item.NotificationCount ?? 0,
  }));

  return {
    eventId: raw.eventId ?? raw.EventId ?? 0,
    total: raw.total ?? raw.Total ?? invitations.length,
    notified: raw.notified ?? raw.Notified ?? 0,
    responded: raw.responded ?? raw.Responded ?? 0,
    pending: raw.pending ?? raw.Pending ?? Math.max(0, (raw.total ?? invitations.length) - (raw.responded ?? 0)),
    invitations,
  };
}

export default {
  getInvitations: async (eventId: number) => {
    const data = await request<Json>(`/events/${eventId}/survey-invitations`);
    return normalizeSummary(data);
  },
  resendInvitation: (eventId: number, invitationId: number) =>
    request(`/events/${eventId}/survey-invitations/${invitationId}/resend`, 'POST'),
  resendPending: (eventId: number) =>
    request(`/events/${eventId}/survey-invitations/resend-pending`, 'POST'),
  generateInvitations: (eventId: number) =>
    request(`/events/${eventId}/survey-invitations/generate`, 'POST'),
};
