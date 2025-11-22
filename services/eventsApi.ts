import keycloak from './keycloakService';

const BASE_URL = import.meta.env.VITE_EVENTS_API_URL || 'http://localhost:5002';

type Json = any;

async function request<T>(path: string, method = 'GET', body?: any): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = keycloak.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    // If unauthorized, try to refresh token once and retry
    if (res.status === 401) {
      const refreshed = await keycloak.ensureTokenValid(30).catch(() => false);
      if (refreshed) {
        const newToken = keycloak.getToken();
        if (newToken) headers['Authorization'] = `Bearer ${newToken}`;
        const retry = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
        if (!retry.ok) {
          if (retry.status === 401) throw new Error('SESSION_EXPIRED');
          throw new Error(`HTTP ${retry.status} ${retry.statusText}`);
        }
        if (retry.status === 204) return {} as T;
        return (await retry.json()) as T;
      }
      throw new Error('SESSION_EXPIRED');
    }
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  // Some endpoints return empty 204
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

// Map backend EventDto -> frontend Evento
function mapEvent(dto: any) {
  return {
    id: dto.id,
    nombre: dto.name,
    descripcion: dto.description,
    fecha: dto.date, // ISO string (DateOnly -> yyyy-MM-dd)
    ubicacion: `Escenario ${dto.stageId}`,
    posterUrl: `https://picsum.photos/seed/event-${dto.id}/800/500`,
    stageId: dto.stageId,
  };
}

export default {
  getEvents: async () => {
    const data = await request<Json[]>('/Events');
    return data.map(mapEvent);
  },
  getEvent: async (id: number) => {
    const dto = await request<Json>(`/Events/${id}`);
    return mapEvent(dto);
  },
  createEvent: async (payload: { name: string; description: string; date: string; stageId: number }) => {
    const created = await request<Json>('/Events', 'POST', payload);
    return created; // controller returns { id, message }
  },
  updateEvent: async (id: number, payload: { name: string; description: string; date: string; stageId: number }) => {
    return request(`/Events/${id}`, 'PUT', payload);
  },
  deleteEvent: async (id: number) => {
    return request(`/Events/${id}`, 'DELETE');
  },
  publishEvent: async (id: number) => {
    return request(`/Events/${id}/publish`, 'POST');
  },
  cancelEvent: async (id: number) => {
    return request(`/Events/${id}/cancel`, 'POST');
  },

  // Stages
  getStages: async () => request<Json[]>('/Stage'),
  getStage: async (id: number) => request<Json>(`/Stage/${id}`),
  createStage: async (payload: any) => request<Json>('/Stage', 'POST', payload),
  updateStage: async (id: number, payload: any) => request<Json>(`/Stage/${id}`, 'PUT', payload),
  deleteStage: async (id: number) => request<Json>(`/Stage/${id}`, 'DELETE'),

  // Seats
  // Fetch seats and map backend Seat -> frontend Asiento shape. If stageId provided, filter by it.
  getSeats: async (stageId?: number) => {
    const raw = await request<Json[]>('/Seat');
    const filtered = typeof stageId === 'number' ? raw.filter(s => s.stageId === stageId || s.StageId === stageId) : raw;

    // Build zone name -> numeric id map
    const zoneNames = Array.from(new Set(filtered.map(s => s.zone || s.Zone || 'General')));
    const zoneMap: Record<string, number> = {};
    const zonas = zoneNames.map((zn, idx) => {
      zoneMap[zn] = idx + 1;
      return { id: idx + 1, nombre: zn, precio: 100 + idx * 50, color: ['#F87171', '#60A5FA', '#34D399'][idx % 3] };
    });

    const seats = filtered.map(s => ({
      id: (s.stageId ?? s.StageId) + '-' + (s.row_number ?? s.RowNumber ?? 'R1') + '-' + (s.seatnumber ?? s.SeatNumber ?? 1),
      rawId: s.id,
      escenarioId: s.stageId ?? s.StageId,
      zonaId: zoneMap[s.zone ?? s.Zone ?? 'General'],
      fila: s.row_number ?? s.RowNumber ?? 'R1',
      numero: (s.seatnumber ?? s.SeatNumber ?? 1).toString(),
      estado: 'disponible' as const,
    }));

    return { seats, zonas };
  },
  // createSeat expects backend AddSeatDto shape: { row_number, seatnumber, zone, StageId }
  createSeat: async (payload: { row_number: string; seatnumber: number; zone: string; StageId: number }) => request<Json>('/Seat', 'POST', payload),
  updateSeat: async (id: number, payload: { row_number: string; seatnumber: number; zone: string; StageId: number }) => request<Json>(`/Seat/${id}`, 'PUT', payload),
  deleteSeat: async (id: number) => request<Json>(`/Seat/${id}`, 'DELETE'),

  // Promotions
  getPromotions: async () => request<Json[]>('/Promotion'),
  createPromotion: async (payload: any) => request<Json>('/Promotion', 'POST', payload),
  updatePromotion: async (id: number, payload: any) => request<Json>(`/Promotion/${id}`, 'PUT', payload),
  deletePromotion: async (id: number) => request<Json>(`/Promotion/${id}`, 'DELETE'),
};
