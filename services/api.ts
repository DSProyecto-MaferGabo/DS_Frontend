
import keycloak from './keycloakService';

const BASE_URL = 'http://localhost:4000';

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
