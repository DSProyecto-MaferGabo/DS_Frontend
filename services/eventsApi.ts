import keycloak from './keycloakService';
import type { EventRequest, EventFormat } from '../types';

// Default to the API Gateway with the '/api' prefix so production builds
// talk to the gateway. Override with VITE_EVENTS_API_URL in env when needed.
const BASE_URL = import.meta.env.VITE_EVENTS_API_URL || 'http://localhost:5278/api';
const POSTER_PLACEHOLDER = 'https://picsum.photos/seed/ds-events/900/600';

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

const normalizeFormat = (value: any): EventFormat => {
  const normalized = (value ?? '').toString().trim().toLowerCase();
  if (normalized === 'streaming' || normalized === 'hibrido') return normalized;
  return 'presencial';
};

const normalizeStreamingUrl = (value: any): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

// Map backend EventDto -> frontend Evento
function mapEvent(dto: any) {
  const pickPosterUrl = () => {
    const raw = dto.posterUrl ?? dto.PosterUrl ?? dto.poster_url ?? dto.posterURL;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  };
  const posterUrl = pickPosterUrl() ?? POSTER_PLACEHOLDER;
  const eventFormat = normalizeFormat(dto.eventFormat ?? dto.EventFormat);
  const streamingUrl = normalizeStreamingUrl(dto.streamingUrl ?? dto.StreamingUrl);
  return {
    id: dto.id,
    nombre: dto.name,
    descripcion: dto.description,
    fecha: dto.date, // ISO string (DateOnly -> yyyy-MM-dd)
    hora: dto.time ?? dto.Time ?? null,
    // Prefer an explicit location from the DTO when present; avoid defaulting to `Escenario ${stageId}`
    ubicacion: dto.location ?? dto.ubicacion ?? '',
    posterUrl,
    posterStorageObjectKey: dto.posterStorageObjectKey ?? dto.PosterStorageObjectKey ?? null,
    // Accept both camelCase and PascalCase from backend to avoid losing stageId and falling back to all seats
    stageId: dto.stageId ?? dto.StageId,
  // Precio general para eventos sin asientos (streaming / tarifa única)
  generalPrice: dto.generalPrice ?? dto.GeneralPrice ?? dto.price ?? dto.Price ?? null,
  // keep category information if present so frontend can filter by category
  categoryId: dto.categoryId ?? dto.CategoryId ?? dto.category?.id ?? dto.category?.Id ?? null,
  eventFormat,
  streamingUrl,
  ownerId: dto.ownerId ?? dto.OwnerId ?? dto.ownerSub ?? dto.OwnerSub ?? null,
  // include state/raw status so UI can decide visibility (published/cancelled/etc)
  state: (dto.state ?? dto.State ?? dto.estado ?? dto.status ?? dto.Status ?? null),
  // explicit flags from backend when available
  isPublished: (dto.isPublished ?? dto.published ?? null),
  isCancelled: (dto.isCancelled ?? dto.cancelled ?? dto.canceled ?? null),
  // convenience fallback: if explicit isPublished not provided, try to infer from state
  _inferredPublished: (() => {
    const s = (dto.state ?? dto.State ?? dto.estado ?? dto.status ?? null);
    if (dto.isPublished !== undefined && dto.isPublished !== null) return dto.isPublished === true;
    try {
      return s ? (String(s).toLowerCase().includes('publ') || String(s).toLowerCase().includes('activo') || String(s).toLowerCase().includes('publicado')) : false;
    } catch { return false; }
  })(),
  };
}

function mapEventRequest(dto: any): EventRequest {
  return {
    id: dto.id ?? dto.Id,
    name: dto.name ?? dto.Name ?? '',
    description: dto.description ?? dto.Description ?? '',
    date: dto.date ?? dto.Date ?? '',
    time: dto.time ?? dto.Time ?? null,
    stageId: dto.stageId ?? dto.StageId,
    categoryId: dto.categoryId ?? dto.CategoryId ?? null,
    eventFormat: normalizeFormat(dto.eventFormat ?? dto.EventFormat),
    streamingUrl: normalizeStreamingUrl(dto.streamingUrl ?? dto.StreamingUrl),
    ownerSub: dto.ownerSub ?? dto.OwnerSub ?? '',
    status: dto.status ?? dto.Status ?? 'Desconocido',
    createdAt: dto.createdAt ?? dto.CreatedAt ?? new Date().toISOString(),
    approvedAt: dto.approvedAt ?? dto.ApprovedAt ?? null,
    rejectedAt: dto.rejectedAt ?? dto.RejectedAt ?? null,
  };
}

export default {
  getEvents: async () => {
    const data = await request<Json[]>('/Events');
    // Fetch stages once to enrich events with stage location when DTO doesn't provide a location
    let stages: any[] = [];
  
  // Updated endpoint for admin events
  
    try {
    const data = await request<Json[]>('/admin/events');
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
  createEvent: async (payload: { name: string; description: string; date: string; time?: string | null; stageId: number; categoryId?: number | null; eventFormat: EventFormat; streamingUrl?: string | null; posterUrl?: string | null; posterStorageObjectKey?: string | null }) => {
    const created = await request<Json>('/Events', 'POST', payload);
    return created; // controller returns { id, message }
  },
  updateEvent: async (id: number, payload: { name: string; description: string; date: string; stageId: number; categoryId?: number | null; eventFormat: EventFormat; streamingUrl?: string | null; posterUrl?: string | null; posterStorageObjectKey?: string | null }) => {
    return request(`/Events/${id}`, 'PUT', payload);
  },
  updatePoster: async (id: number, payload: { posterUrl?: string | null; posterStorageObjectKey?: string | null }) => {
    return request(`/Events/${id}/poster`, 'PUT', payload);
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
    // If backend did not provide meaningful fila/numero values (all default to R1/1),
    // compute them client-side: every 10 seats create a new fila, numeros 1..10
    const allDefaultFila = seats.length > 0 && seats.every(se => se.fila === 'R1');
    const allDefaultNumero = seats.length > 0 && seats.every(se => se.numero === '1');
    if (allDefaultFila && allDefaultNumero) {
      for (let i = 0; i < seats.length; i++) {
        const rowIndex = Math.floor(i / 10) + 1;
        const seatNumber = (i % 10) + 1;
        seats[i].fila = `R${rowIndex}`;
        seats[i].numero = String(seatNumber);
        // update id if it was generated from fila/numero pattern
        if (!seats[i].rawId) {
          seats[i].id = `${seats[i].escenarioId}-${seats[i].fila}-${seats[i].numero}`;
        }
      }
    }

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

  getMyEvents: async () => {
    const data = await request<Json[]>('/events/my-events');
    return (data || []).map(mapEvent);
  },

  getAdminEvents: async () => {
    const data = await request<Json[]>('/admin/events');
    return (data || []).map(mapEvent);
  },

  // Event Requests (organizador + admin/soporte)
  createEventRequest: async (payload: {
    name: string;
    description: string;
    date: string;
    time?: string | null;
    stageId: number;
    categoryId?: number | null;
    eventFormat: EventFormat;
    streamingUrl?: string | null;
    zones?: Array<{ name: string; price: number; seatCount: number }>; // Made optional
    posterFile?: File;
    programFile?: File;
    receiptFile?: File;
  }) => {
    // Send complete payload including zones (empty array if not provided)
    const completePayload = {
      name: payload.name,
      description: payload.description,
      date: payload.date,
      time: payload.time,
      stageId: payload.stageId,
      categoryId: payload.categoryId,
      eventFormat: payload.eventFormat,
      streamingUrl: payload.streamingUrl,
      zones: payload.zones || []
    };
    return request<Json>('/event-requests', 'POST', completePayload);
  },
  getMyEventRequests: async () => {
    const data = await request<Json[]>('/event-requests/my');
    return (data || []).map(mapEventRequest);
  },
  getPendingEventRequests: async () => {
    const data = await request<Json[]>('/event-requests/pending');
    return (data || []).map(mapEventRequest);
  },
  approveEventRequest: async (id: number) => {
    return request<Json>(`/event-requests/${id}/approve`, 'POST');
  },
};

export async function getPromotionReport() {
  // Simulación: reemplaza con endpoint real
  return [
    { code: 'PROMO10', description: '10% de descuento', redemptions: 25, validUntil: '2026-02-01' },
    { code: 'PROMO20', description: '20% de descuento', redemptions: 12, validUntil: '2026-03-01' },
  ];
}

