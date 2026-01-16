import api from './api';
import keycloak from './keycloakService';

const BASE = import.meta.env.VITE_USERS_API_URL || 'http://127.0.0.1:5278/api';
const DIRECT_BASE = import.meta.env.VITE_USERS_API_DIRECT || 'http://127.0.0.1:5224/api';

async function authedFetch<T>(path: string, method: string, body?: any): Promise<T> {
  return authedFetchWithBase<T>(BASE, path, method, body);
}

async function authedFetchDirect<T>(path: string, method: string, body?: any): Promise<T> {
  return authedFetchWithBase<T>(DIRECT_BASE, path, method, body);
}

async function authedFetchWithBase<T>(base: string, path: string, method: string, body?: any): Promise<T> {
  try {
    await keycloak.ensureTokenValid(30);
  } catch {
    // ignore
  }
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const token = keycloak.getToken();
  if (token) headers.append('Authorization', `Bearer ${token}`);
  const url = `${base}${path}`;
  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    const error: any = new Error(`HTTP ${resp.status} ${resp.statusText}${txt ? `: ${txt}` : ''}`);
    (error as any).status = resp.status;
    throw error;
  }
  const text = await resp.text();
  return text ? (JSON.parse(text) as T) : (null as unknown as T);
}

async function trySequence<T>(requests: Array<() => Promise<T>>): Promise<T> {
  let lastError: any;
  for (const req of requests) {
    try {
      return await req();
    } catch (err: any) {
      lastError = err;
      // on 404/405 continue to next candidate
      if (err?.status === 404 || err?.status === 405) continue;
      throw err;
    }
  }
  throw lastError ?? new Error('All support endpoints failed');
}

export interface SupportTicket {
  id: number;
  eventId: number;
  reporterUserId: number;
  organizerUserId: number;
  supportUserId?: number | null;
  title: string;
  description: string;
  status: string;
  reporterEmail?: string;
  organizerEmail?: string;
  supportEmail?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupportTicketPayload {
  eventId: number;
  organizerUserId: number;
  title: string;
  description: string;
}

export interface UpdateSupportTicketStatusPayload {
  status: string;
  supportUserId?: number | null;
}

export default {
  createTicket: async (payload: CreateSupportTicketPayload): Promise<SupportTicket> => {
    return trySequence<SupportTicket>([
      () => api.post('/support-tickets', payload),
      () => authedFetch('/support-tickets', 'POST', payload),
      () => authedFetchDirect('/support-tickets', 'POST', payload),
      () => authedFetch('/SupportTicket', 'POST', payload),
      () => authedFetch('/SupportTickets', 'POST', payload),
      () => authedFetchDirect('/SupportTicket', 'POST', payload),
      () => authedFetchDirect('/SupportTickets', 'POST', payload),
      () => authedFetch('/users/support-tickets', 'POST', payload),
      () => authedFetch('/users/SupportTicket', 'POST', payload),
      () => authedFetch('/users/SupportTickets', 'POST', payload),
      () => authedFetchDirect('/users/support-tickets', 'POST', payload),
      () => authedFetchDirect('/users/SupportTicket', 'POST', payload),
      () => authedFetchDirect('/users/SupportTickets', 'POST', payload),
    ]);
  },
  getMyTickets: async (): Promise<SupportTicket[]> => {
    return trySequence<SupportTicket[]>([
      () => api.get('/support-tickets/my'),
      () => authedFetch('/support-tickets/my', 'GET'),
      () => authedFetchDirect('/support-tickets/my', 'GET'),
      () => authedFetch('/SupportTicket/my', 'GET'),
      () => authedFetch('/SupportTickets/my', 'GET'),
      () => authedFetchDirect('/SupportTicket/my', 'GET'),
      () => authedFetchDirect('/SupportTickets/my', 'GET'),
      () => authedFetch('/users/support-tickets/my', 'GET'),
      () => authedFetch('/users/SupportTicket/my', 'GET'),
      () => authedFetch('/users/SupportTickets/my', 'GET'),
      () => authedFetchDirect('/users/support-tickets/my', 'GET'),
      () => authedFetchDirect('/users/SupportTicket/my', 'GET'),
      () => authedFetchDirect('/users/SupportTickets/my', 'GET'),
    ]);
  },
  updateStatus: async (id: number, payload: UpdateSupportTicketStatusPayload): Promise<SupportTicket> => {
    // Backend expone PATCH api/support-tickets/{id}/status
    return trySequence<SupportTicket>([
      () => api.patch(`/support-tickets/${id}/status`, payload),
      () => authedFetch(`/support-tickets/${id}/status`, 'PATCH', payload),
      () => authedFetchDirect(`/support-tickets/${id}/status`, 'PATCH', payload),
      // fallback aliases (may not exist)
      () => authedFetch(`/SupportTickets/${id}/status`, 'PATCH', payload),
      () => authedFetchDirect(`/SupportTickets/${id}/status`, 'PATCH', payload),
      () => authedFetch(`/users/support-tickets/${id}/status`, 'PATCH', payload),
      () => authedFetchDirect(`/users/support-tickets/${id}/status`, 'PATCH', payload),
    ]);
  }
};
