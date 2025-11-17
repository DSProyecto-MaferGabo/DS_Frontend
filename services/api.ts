
import keycloak from './keycloakService';

const BASE_URL = import.meta.env.VITE_USERS_API_URL || 'http://localhost:5224';

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
  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  if (keycloak.authenticated) {
    headers.append('Authorization', `Bearer ${keycloak.token}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export default api;

// Convenience helper to create or sync a user in the Users-service from an auth provider
export async function createUserFromAuth(payload: { Email: string; Role: string[]; DisplayName?: string; PhotoURL?: string; }) {
  return api.post('/User/from-auth', payload);
}
