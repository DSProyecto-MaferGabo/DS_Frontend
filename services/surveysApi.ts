import keycloak from './keycloakService';
import type { SurveyInvitationSummary } from '../types';

const BASE_URL = import.meta.env.VITE_SURVEYS_API_URL || 'http://localhost:5206/api';
const GATEWAY_BASE = import.meta.env.VITE_API_GATEWAY_URL || 'http://127.0.0.1:5278/api';

type Json = any;

async function request<T>(path: string, method = 'GET', body?: any): Promise<T> {
  // Delegate to absolute helper with BASE_URL prefix
  return requestAbsolute<T>(`${BASE_URL}${path}`, method, body);
}

async function requestAbsolute<T>(url: string, method = 'GET', body?: any): Promise<T> {
  const buildHeaders = (withAuth: boolean) => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (withAuth) {
      const token = keycloak.getToken();
      if (token) h['Authorization'] = `Bearer ${token}`;
    }
    return h;
  };

  try {
    await keycloak.ensureTokenValid(30);
  } catch {
    // ignore
  }

  const doFetch = async (withAuth: boolean) => {
    const res = await fetch(url, {
      method,
      headers: buildHeaders(withAuth),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      return { ok: false, status: res.status, text: await res.text().catch(() => '') };
    }
    if (res.status === 204) return { ok: true, data: {} as T, text: '' };
    const text = await res.text();
    return { ok: true, data: text ? (JSON.parse(text) as T) : ({} as T), text };
  };

  // first try with auth, then without (some envs may not require auth or have audience mismatch)
  let result = await doFetch(true);
  if (!result.ok && result.status === 401) {
    result = await doFetch(false);
  }
  if (!result.ok) {
    const err: any = new Error(result.text || `HTTP ${result.status}`);
    err.status = result.status;
    throw err;
  }
  return result.data as T;
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
    // Try backend direct, then gateway path if protected by gateway
    const paths = [
      `${BASE_URL}/events/${eventId}/survey-invitations`,
      `${BASE_URL}/surveys/events/${eventId}/survey-invitations`,
      `${GATEWAY_BASE}/surveys/events/${eventId}/survey-invitations`,
      `${GATEWAY_BASE}/Surveys/events/${eventId}/survey-invitations`,
      `${GATEWAY_BASE}/events/${eventId}/survey-invitations`
    ];
    let lastErr: any = null;
    for (const url of paths) {
      try {
        const data = await requestAbsolute<Json>(url, 'GET');
        return normalizeSummary(data);
      } catch (e: any) {
        lastErr = e;
        continue;
      }
    }
    // if unauthorized or not found, return empty summary to keep UI usable
    if (lastErr?.status === 401 || lastErr?.status === 404) {
      return normalizeSummary({ eventId, invitations: [], total: 0, notified: 0, responded: 0, pending: 0 });
    }
    throw lastErr ?? new Error('Failed to load survey invitations');
  },
  resendInvitation: (eventId: number, invitationId: number) =>
    request(`/events/${eventId}/survey-invitations/${invitationId}/resend`, 'POST'),
  resendPending: (eventId: number) =>
    request(`/events/${eventId}/survey-invitations/resend-pending`, 'POST'),
  generateInvitations: (eventId: number) =>
    request(`/events/${eventId}/survey-invitations/generate`, 'POST'),
};
