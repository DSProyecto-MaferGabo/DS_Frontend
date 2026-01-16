import * as signalR from '@microsoft/signalr';
import keycloak from './keycloakService';

// Prefer explicit env; fallback to Reservations.API hub (seat signals se emiten desde allí).
const HUB_URL =
  import.meta.env.VITE_SIGNALR_NOTIFICATIONS_HUB ||
  import.meta.env.VITE_RESERVATIONS_SIGNALR_HUB ||
  'http://localhost:5234/hub/reservations';

let connection: signalR.HubConnection | null = null;
let startingPromise: Promise<signalR.HubConnection> | null = null;

export interface SeatUpdatePayload {
  eventId?: number;
  seatCode?: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
}

export interface SeatHoldPayload {
  eventoId?: number;
  token?: string;
  expiresAt?: string;
  seats?: Array<{ asientoId?: number; precio?: number }>;
}

export interface ForumPostPayload {
  topicId?: string;
  postId?: string;
  author?: string;
  content?: string;
  metadata?: Record<string, unknown> | null;
}

export interface ServiceStatusPayload {
  reservationId?: number;
  serviceId?: number;
  serviceName?: string;
  status?: string;
  price?: number;
  metadata?: Record<string, unknown> | null;
}

export interface SurveyInvitationPayload {
  invitationId?: number;
  eventId?: number;
  surveyUrl?: string;
  message?: string;
  metadata?: Record<string, unknown> | null;
}

async function startConnection() {
  if (connection && connection.state === signalR.HubConnectionState.Connected) {
    return connection;
  }

  if (connection && (connection.state === signalR.HubConnectionState.Connecting || connection.state === signalR.HubConnectionState.Reconnecting)) {
    return connection;
  }

  if (startingPromise) return startingPromise;

  startingPromise = new Promise<signalR.HubConnection>(async (resolve) => {
    // ensure fresh token when available
    let token: string | undefined;
    try {
      await keycloak.ensureTokenValid(30);
      token = keycloak.getToken() || undefined;
    } catch {
      token = keycloak.getToken() || undefined;
    }

    connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: token ? () => token! : undefined,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: ctx => Math.min(1000 * Math.pow(2, ctx.previousRetryCount), 15000)
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    try {
      await connection.start();
    } catch (err) {
      console.warn('[NotificationHub] start failed', err);
    } finally {
      startingPromise = null;
    }

    resolve(connection);
  });

  return startingPromise;
}

export async function ensureNotificationHubConnection(): Promise<signalR.HubConnection> {
  const conn = await startConnection();
  if (conn.state === signalR.HubConnectionState.Disconnected) {
    try {
      await conn.start();
    } catch (err) {
      console.warn('[NotificationHub] retry start failed', err);
    }
  }
  return conn;
}

export async function joinUserChannel(userId: string) {
  if (!userId) return;
  const conn = await ensureNotificationHubConnection();
  return conn.invoke('JoinUserChannel', userId).catch(err => {
    console.warn('[NotificationHub] join user channel failed', err);
  });
}

export async function leaveUserChannel(userId: string) {
  if (!userId) return;
  const conn = await ensureNotificationHubConnection();
  return conn.invoke('LeaveUserChannel', userId).catch(err => {
    console.warn('[NotificationHub] leave user channel failed', err);
  });
}

export async function joinReservationChannel(reservationId: number) {
  if (!reservationId) return;
  const conn = await ensureNotificationHubConnection();
  return conn.invoke('JoinReservationChannel', reservationId).catch(err => {
    console.warn('[NotificationHub] join reservation channel failed', err);
  });
}

export async function leaveReservationChannel(reservationId: number) {
  if (!reservationId) return;
  const conn = await ensureNotificationHubConnection();
  return conn.invoke('LeaveReservationChannel', reservationId).catch(err => {
    console.warn('[NotificationHub] leave reservation channel failed', err);
  });
}

export async function joinEventChannel(eventId: number) {
  if (!eventId) return;
  const conn = await ensureNotificationHubConnection();
  return conn.invoke('JoinEventChannel', eventId).catch(err => {
    console.warn('[NotificationHub] join event channel failed', err);
  });
}

export async function leaveEventChannel(eventId: number) {
  if (!eventId) return;
  const conn = await ensureNotificationHubConnection();
  return conn.invoke('LeaveEventChannel', eventId).catch(err => {
    console.warn('[NotificationHub] leave event channel failed', err);
  });
}

export async function joinForumChannel(topicId: string | number) {
  const value = topicId?.toString().trim();
  if (!value) return;
  const conn = await ensureNotificationHubConnection();
  return conn.invoke('JoinForumChannel', value).catch(err => {
    console.warn('[NotificationHub] join forum channel failed', err);
  });
}

export async function leaveForumChannel(topicId: string | number) {
  const value = topicId?.toString().trim();
  if (!value) return;
  const conn = await ensureNotificationHubConnection();
  return conn.invoke('LeaveForumChannel', value).catch(err => {
    console.warn('[NotificationHub] leave forum channel failed', err);
  });
}

export async function registerPaymentResultHandler(handler: (payload: any) => void) {
  const conn = await ensureNotificationHubConnection();
  conn.on('ReceivePaymentResult', handler);
  return () => {
    conn.off('ReceivePaymentResult', handler);
  };
}

export async function registerSeatUpdateHandler(handler: (payload: SeatUpdatePayload) => void) {
  const conn = await ensureNotificationHubConnection();
  const bound = (payload: SeatUpdatePayload) => handler(payload);
  conn.on('ReceiveSeatUpdate', bound);
  return () => {
    conn.off('ReceiveSeatUpdate', bound);
  };
}

export async function registerSeatHoldCreatedHandler(handler: (payload: SeatHoldPayload) => void) {
  const conn = await ensureNotificationHubConnection();
  const bound = (payload: SeatHoldPayload) => handler(payload);
  conn.on('SeatHoldCreated', bound);
  return () => {
    conn.off('SeatHoldCreated', bound);
  };
}

export async function registerSeatHoldReleasedHandler(handler: (payload: SeatHoldPayload) => void) {
  const conn = await ensureNotificationHubConnection();
  const bound = (payload: SeatHoldPayload) => handler(payload);
  conn.on('SeatHoldReleased', bound);
  return () => {
    conn.off('SeatHoldReleased', bound);
  };
}

export async function registerSeatHoldExpiredHandler(handler: (payload: SeatHoldPayload) => void) {
  const conn = await ensureNotificationHubConnection();
  const bound = (payload: SeatHoldPayload) => handler(payload);
  conn.on('SeatHoldExpired', bound);
  return () => {
    conn.off('SeatHoldExpired', bound);
  };
}

export async function registerForumPostHandler(handler: (payload: ForumPostPayload) => void) {
  const conn = await ensureNotificationHubConnection();
  const bound = (payload: ForumPostPayload) => handler(payload);
  conn.on('ReceiveNewForumPost', bound);
  return () => {
    conn.off('ReceiveNewForumPost', bound);
  };
}

export async function registerServiceStatusHandler(handler: (payload: ServiceStatusPayload) => void) {
  const conn = await ensureNotificationHubConnection();
  const bound = (payload: ServiceStatusPayload) => handler(payload);
  conn.on('ReceiveServiceStatus', bound);
  return () => {
    conn.off('ReceiveServiceStatus', bound);
  };
}

export async function registerSurveyInvitationHandler(handler: (payload: SurveyInvitationPayload) => void) {
  const conn = await ensureNotificationHubConnection();
  const bound = (payload: SurveyInvitationPayload) => handler(payload);
  conn.on('ReceiveSurveyInvitation', bound);
  return () => {
    conn.off('ReceiveSurveyInvitation', bound);
  };
}

export async function stopNotificationHub() {
  if (connection) {
    try {
      await connection.stop();
    } catch {
      // ignore
    }
    connection = null;
  }
}
