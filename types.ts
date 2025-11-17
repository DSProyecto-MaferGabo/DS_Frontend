export interface Evento {
  id: number;
  nombre: string;
  descripcion: string;
  fecha: string;
  ubicacion: string;
  posterUrl: string;
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
  estado: 'disponible' | 'ocupado' | 'seleccionado';
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
