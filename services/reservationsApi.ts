import keycloak from './keycloakService';

const BASE_URL = import.meta.env.VITE_RESERVATIONS_API_URL || 'http://localhost:5278/api';

type Json = any;

async function request<T>(path: string, method = 'GET', body?: any): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Ensure token is valid / refreshed before making request (helps avoid 403/401 due to expired token)
  try {
    await keycloak.ensureTokenValid(30);
  } catch { /* ignore refresh errors - we'll handle below */ }
  const token = keycloak.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let serverMsg = '';
    try { serverMsg = JSON.parse(text)?.message ?? text; } catch { serverMsg = text; }
    if (res.status === 401) {
      const refreshed = await keycloak.ensureTokenValid(30).catch(() => false);
      if (refreshed) {
        const newToken = keycloak.getToken();
        if (newToken) headers['Authorization'] = `Bearer ${newToken}`;
        const retry = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
        if (!retry.ok) {
          if (retry.status === 401) throw new Error('SESSION_EXPIRED');
          const rt = await retry.text().catch(() => '');
          let rmsg = '';
          try { rmsg = JSON.parse(rt)?.message ?? rt; } catch { rmsg = rt; }
          throw new Error(`HTTP ${retry.status} ${retry.statusText}: ${rmsg}`);
        }
        if (retry.status === 204) return {} as T;
        return (await retry.json()) as T;
      }
      throw new Error('SESSION_EXPIRED');
    }
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${serverMsg}`);
  }

  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

export default {
  getAdditionalServices: async () => {
    const raw = await request<Json[]>('/AdditionalService');
    // normalize casing (API may return camelCase or PascalCase)
    return (raw || []).map((x: any) => ({
      Id: x.Id ?? x.id,
      Name: x.Name ?? x.name,
      Description: x.Description ?? x.description,
      Price: x.Price ?? x.price,
    }));
  },
  getReservations: async (usuarioId?: string) => {
    const q = usuarioId ? `?usuarioId=${encodeURIComponent(usuarioId)}` : '';
    return request<Json[]>(`/Reservation${q}`, 'GET');
  },
  createHold: async (payload: { eventoId: number; seats: { asientoId:string; precio:number }[]; durationMinutes?: number }) =>
    request<Json>('/Reservation/hold', 'POST', payload),
  releaseHold: async (token: string) => request<Json>(`/Reservation/hold/${encodeURIComponent(token)}`, 'DELETE'),
  createReservation: async (payload: { date: string; state: string; eventoId?: number; total?: number; additionalServiceIds?: number[]; seats?: { asientoId: string; precio: number }[]; holdToken?: string | null; couponCode?: string | null }) => request<Json>('/Reservation', 'POST', payload),
  createAdditionalService: async (payload: { name: string; description: string; price: number }) => request<Json>('/AdditionalService', 'POST', payload),
  updateAdditionalService: async (id: number, payload: { name: string; description: string; price: number }) => request<Json>(`/AdditionalService/${id}`, 'PUT', payload),
  deleteAdditionalService: async (id: number) => request<Json>(`/AdditionalService/${id}`, 'DELETE'),
};
