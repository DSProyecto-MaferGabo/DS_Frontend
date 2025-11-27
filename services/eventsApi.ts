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
    // Try to read response body for diagnostics
    let textBody: string | null = null;
    try { textBody = await res.text(); } catch (e) { textBody = null; }
    console.error(`[eventsApi] HTTP ${res.status} ${res.statusText} -> ${method} ${BASE_URL}${path}`, textBody);
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
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${textBody ?? ''}`);
  }
  // Handle potentially empty success responses (some controllers return Ok() with empty body)
  const text = await res.text();
  if (!text || text.trim() === '') return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    console.error('[eventsApi] Failed to parse JSON response for', `${method} ${BASE_URL}${path}`, text);
    throw new Error('Invalid JSON response from server');
  }
}

// Map backend EventDto -> frontend Evento
function mapEvent(dto: any) {
  return {
    id: dto.id,
    nombre: dto.name,
    descripcion: dto.description,
    fecha: dto.date, // ISO string (DateOnly -> yyyy-MM-dd)
    hora: dto.time ?? dto.Time ?? null,
    // Prefer an explicit location from the DTO when present; avoid defaulting to `Escenario ${stageId}`
    ubicacion: dto.location ?? dto.ubicacion ?? '',
    posterUrl: `https://picsum.photos/seed/event-${dto.id}/800/500`,
    stageId: dto.stageId,
  // keep category information if present so frontend can filter by category
  categoryId: dto.categoryId ?? dto.CategoryId ?? dto.category?.id ?? dto.category?.Id ?? null,
  };
}

export default {
  getEvents: async () => {
    const data = await request<Json[]>('/Events');
    // Fetch stages once to enrich events with stage location when DTO doesn't provide a location
    let stages: any[] = [];
    try {
      stages = await request<Json[]>('/Stage');
    } catch (e) {
      console.warn('Could not load stages to enrich events', e);
    }
    const stageMap: Record<number, any> = {};
    (stages || []).forEach(s => { stageMap[s.id ?? s.Id] = s; });

    const mapped = (data || []).map((dto: any) => {
      const evt = mapEvent(dto);
      // prefer explicit dto location, otherwise use stage location when available
      if (!evt.ubicacion) {
        const s = stageMap[dto.stageId ?? dto.StageId];
        evt.ubicacion = s?.location ?? s?.Location ?? '';
      }
      return evt;
    });
    return mapped;
  },
  getCategories: async () => {
    const data = await request<Json[]>('/Category');
    return (data || []).map((c: any) => ({ id: c.id ?? c.Id, name: c.name ?? c.Name }));
  },
  createCategory: async (payload: { name: string; description?: string }) => {
    return request<Json>('/Category', 'POST', payload);
  },
  updateCategory: async (id: number, payload: { name: string; description?: string }) => {
    return request<Json>(`/Category/${id}`, 'PUT', payload);
  },
  deleteCategory: async (id: number) => {
    return request<Json>(`/Category/${id}`, 'DELETE');
  },
  getEvent: async (id: number) => {
    const dto = await request<Json>(`/Events/${id}`);
    return mapEvent(dto);
  },
  createEvent: async (payload: { name: string; description: string; date: string; time?: string | null; stageId: number; categoryId?: number | null }) => {
    const created = await request<Json>('/Events', 'POST', payload);
    return created; // controller returns { id, message }
  },
  updateEvent: async (id: number, payload: { name: string; description: string; date: string; stageId: number; categoryId?: number | null }) => {
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
      const sample = filtered.find(s => (s.zone ?? s.Zone) === zn);
      const price = (sample && (sample.price ?? sample.Price)) ? (sample.price ?? sample.Price) : (100 + idx * 50);
      return { id: idx + 1, nombre: zn, precio: price, color: ['#F87171', '#60A5FA', '#34D399'][idx % 3] };
    });

    const seats = filtered.map(s => {
      // Prefer DB-generated numeric id (Id | id) as unique identifier to avoid collisions
      const rawId = s.id ?? s.Id ?? s.ID ?? null;
      const uniqueId = rawId != null ? String(rawId) : `${(s.stageId ?? s.StageId)}-${(s.row_number ?? s.RowNumber ?? 'R1')}-${(s.seatnumber ?? s.SeatNumber ?? 1)}`;
      return {
        id: uniqueId,
        rawId: rawId,
        escenarioId: s.stageId ?? s.StageId,
        zonaId: zoneMap[s.zone ?? s.Zone ?? 'General'],
        fila: s.row_number ?? s.RowNumber ?? 'R1',
        numero: (s.seatnumber ?? s.SeatNumber ?? 1).toString(),
        estado: 'disponible' as const,
      };
    });

    return { seats, zonas };
  },
  // createSeat expects backend AddSeatDto shape: { row_number, seatnumber, zone, StageId }
  createSeat: async (payload: { row_number: string; seatnumber: number; zone: string; StageId: number; price?: number }) => request<Json>('/Seat', 'POST', payload),
  updateSeat: async (id: number, payload: { row_number: string; seatnumber: number; zone: string; StageId: number; price?: number }) => request<Json>(`/Seat/${id}`, 'PUT', payload),
  deleteSeat: async (id: number) => request<Json>(`/Seat/${id}`, 'DELETE'),

  // Promotions
  getPromotions: async () => request<Json[]>('/Promotion'),
  createPromotion: async (payload: any) => request<Json>('/Promotion', 'POST', payload),
  updatePromotion: async (id: number, payload: any) => request<Json>(`/Promotion/${id}`, 'PUT', payload),
  deletePromotion: async (id: number) => request<Json>(`/Promotion/${id}`, 'DELETE'),
};

