export type EventFormat = 'presencial' | 'streaming' | 'hibrido';

export interface Evento {
  id: number;
  nombre: string;
  descripcion: string;
  fecha: string;
  ubicacion: string;
  // Precio general para eventos sin asientos (streaming o tarifa única)
  generalPrice?: number | null;
  posterUrl?: string | null;
  posterStorageObjectKey?: string | null;
  stageId?: number;
  hora?: string | null;
  categoryId?: number | null;
  eventFormat?: EventFormat;
  streamingUrl?: string | null;
  ownerId?: string | null;
}

export interface Escenario {
  id: number;
  eventoId: number;
  nombre: string;
}

export interface Zona {
  id: number;
  escenarioId: number;
  nombre: string;
  precio: number;
  color: string;
}

export interface Asiento {
  id: string; // e.g., "1-M26-10"
  escenarioId: number;
  zonaId: number;
  fila: string;
  numero: string;
  estado: 'disponible' | 'ocupado' | 'seleccionado' | 'hold';
}

export interface Reservacion {
  id: number;
  usuarioId: string;
  eventoId: number;
  estado: 'CONFIRMADA' | 'PENDIENTE' | 'CANCELADA';
  total: number;
  fecha: string;
}

export interface ReservacionDetalle {
  id: number;
  reservacionId: number;
  asientoId: string;
  precio: number;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
}

// Mock Keycloak Profile
export interface KeycloakProfile {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    emailVerified: boolean;
    roles: string[];
}

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  active: boolean;
  roleId: number;
  roleName: string;
  externalId?: string | null;
}

export interface UserPermissions {
  userId: number;
  name: string;
  email: string;
  roleName: string;
  privileges: string[];
}

export interface CreateManagedUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  temporaryPassword?: string;
}

export interface AuditLogRecord {
  id?: string;
  transactionId?: string;
  timestamp: string;
  microservice?: string;
  action: string;
  userId?: string;
  userRole?: string;
  status?: string;
  ipAddress?: string;
  details?: Record<string, unknown> | null;
}

export interface AuditLogFilters {
  microservice?: string;
  userId?: string;
  action?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface PlatformStats {
  totalUsers: number;
  activeEvents: number;
  reservationsToday: number;
  criticalErrors24h: number;
  generatedAt?: string;
}

export interface RecommendationProfile {
  userId: string;
  reservationsConfirmed: number;
  eventsViewed: number;
  eventScores: Record<string, number>;
  lastUpdatedUtc: string;
}

export interface RecommendedEventScore {
  eventId: number;
  score: number;
}

export interface EventRequest {
  id: number;
  name: string;
  description: string;
  date: string;
  time?: string | null;
  stageId: number;
  categoryId?: number | null;
  eventFormat: EventFormat;
  streamingUrl?: string | null;
  ownerSub: string;
  status: string;
  createdAt: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
}

export interface SurveyInvitation {
  id: number;
  eventId: number;
  surveyId?: number | null;
  userId: string;
  status: string;
  createdAtUtc: string;
  notifiedAtUtc?: string | null;
  respondedAtUtc?: string | null;
  notificationCount: number;
}

export interface SurveyInvitationSummary {
  eventId: number;
  total: number;
  notified: number;
  responded: number;
  pending: number;
  invitations: SurveyInvitation[];
}
