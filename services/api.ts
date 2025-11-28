
import keycloak from './keycloakService';

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

// Convenience helper to create or sync a user in the Users-service from an auth provider
export async function createUserFromAuth(payload: { Email: string; Role: string[]; DisplayName?: string; PhotoURL?: string; }) {
  return api.post('/User/from-auth', payload);
}
