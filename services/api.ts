import keycloak from './keycloakService';
import type {
  ManagedUser,
  CreateManagedUserPayload,
  UserPermissions,
  AuditLogFilters,
  AuditLogRecord,
  PlatformStats,
} from '../types';

const BASE_URL = import.meta.env.VITE_USERS_API_URL || 'http://localhost:5278/api';

const api = {
  get: async <T,>(path: string): Promise<T> => {
    return request<T>(path, 'GET');
  },
  post: async <T,>(path: string, body: any): Promise<T> => {
    return request<T>(path, 'POST', body);
  },
  put: async <T,>(path: string, body: any): Promise<T> => {
    return request<T>(path, 'PUT', body);
  },
  delete: async <T,>(path: string): Promise<T> => {
    return request<T>(path, 'DELETE');
  },
};

async function request<T,>(path: string, method: string, body?: any): Promise<T> {

  // Ensure token is valid before making requests so protected endpoints receive Authorization header
  try {
    await keycloak.ensureTokenValid(30);
  } catch (e) {
    // ignore; we'll attempt request without token if refresh fails
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  const token = keycloak.getToken();
  if (token) headers.append('Authorization', `Bearer ${token}`);

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    // try to extract error details from body
    let errBody: any = null;
    try {
      const text = await response.text();
      errBody = text ? JSON.parse(text) : text;
    } catch (e) {
      // not JSON
      try { errBody = await response.text(); } catch { errBody = null; }
    }

    const error: any = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    error.body = errBody;
    throw error;
  }

  // Some endpoints (DELETE) may return empty body
  const txt = await response.text();
  return txt ? (JSON.parse(txt) as T) : (null as unknown as T);
}

export default api;

function buildQueryString(params?: Record<string, unknown>) {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) return '';
  const searchParams = new URLSearchParams();
  entries.forEach(([key, value]) => searchParams.append(key, String(value)));
  return `?${searchParams.toString()}`;
}
export async function getUserHistory(userId: string) {
  return api.get(`/users/${userId}/history`);
}

// Convenience helper to create or sync a user in the Users-service from an auth provider
export async function createUserFromAuth(payload: { Email: string; Role: string[]; DisplayName?: string; PhotoURL?: string; }) {
  return api.post('/User/from-auth', payload);
}

export async function getUserByEmail(email: string) {
  return api.get<ManagedUser>(`/User/by-email/${encodeURIComponent(email)}`);
}

export async function getUserPermissions(userId: number) {
  return api.get<UserPermissions>(`/User/${userId}/permissions`);
}

export async function getUsersByRole(role: string) {
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
  return api.get<ManagedUser[]>(`/User${query}`);
}

export async function createOrganizerAccount(payload: CreateManagedUserPayload) {
  return api.post<ManagedUser>('/User/organizers', payload);
}

export async function createSupportAccount(payload: CreateManagedUserPayload) {
  return api.post<ManagedUser>('/User/supports', payload);
}

export async function getAuditLogs(filters?: AuditLogFilters) {
  const query = buildQueryString(filters as Record<string, unknown>);
  try {
    return await api.get<AuditLogRecord[] | { items?: AuditLogRecord[]; records?: AuditLogRecord[] }>(`/logs${query}`);
  } catch (err: any) {
    // If the endpoint is not yet published, surface an empty list instead of failing the view
    if (err?.status === 404) return [];
    throw err;
  }
}

export async function getPlatformStats() {
  try {
    return await api.get<PlatformStats>('/stats/dashboard');
  } catch (err: any) {
    // Gracefully handle missing endpoint while backend is wired
    if (err?.status === 404) return null as unknown as PlatformStats;
    throw err;
  }
}


