import keycloak from './keycloakService';

const BASE_URL = import.meta.env.VITE_PAYMENTS_API_URL || 'http://localhost:5278/api';

type Json = any;

async function request<T>(path: string, method = 'GET', body?: any): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    await keycloak.ensureTokenValid(30);
  } catch {
    /* ignore */
  }
  const token = keycloak.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let textBody: string | null = null;
    try { textBody = await res.text(); } catch { textBody = null; }
    console.error(`[paymentsApi] HTTP ${res.status} ${res.statusText} -> ${method} ${BASE_URL}${path}`, textBody);
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

  const text = await res.text();
  if (!text || text.trim() === '') return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    console.error('[paymentsApi] Failed to parse JSON response for', `${method} ${BASE_URL}${path}`, text);
    throw new Error('Invalid JSON response from server');
  }
}

export default {
  getPaymentMethods: async () => {
    try {
      const data = await request<Json[]>('/PaymentMethod');
      return (data || []).map(pm => ({
        id: pm.id ?? pm.Id,
        type: pm.type ?? pm.Type ?? '',
        detail: pm.detail ?? pm.Detail ?? ''
      }));
    } catch (err) {
      console.warn('[paymentsApi] failed to load payment methods, falling back to static list', err);
      return [
        { id: 1, type: 'Tarjeta de Crédito', detail: 'card' },
        { id: 2, type: 'Tarjeta de Débito', detail: 'card' },
        { id: 3, type: 'Transferencia Bancaria', detail: 'transfer' },
        { id: 4, type: 'PagoMovil', detail: 'pagomovil' }
      ];
    }
  },
  createPayment: async (payload: {
    date: string;
    amount: number;
    state: string;
    reservationId: number;
    paymentMethodId: number;
    purpose?: string | null;
    externalReference?: string | null;
  }) => request<Json>('/Payment', 'POST', {
    date: payload.date,
    amount: payload.amount,
    state: payload.state,
    ReservationId: payload.reservationId,
    PaymentMethodId: payload.paymentMethodId,
    Purpose: payload.purpose ?? 'RESERVATION',
    ExternalReference: payload.externalReference ?? undefined
  }),
  getUserPayments: async (userId?: string) => {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return request<Json[]>(`/Payment${q}`, 'GET');
  },
  getPayments: async () => {
    return request<Json[]>('/Payment', 'GET');
  },
  getBills: async () => {
    return request<Json[]>('/Bill', 'GET');
  },
  getBillingReport: async (year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year) params.append('year', String(year));
    if (month) params.append('month', String(month));
    const qs = params.toString();
    return request<Json>(`/Bill/report${qs ? `?${qs}` : ''}`, 'GET');
  },
  getInvoices: async () => {
    // Simulación: reemplaza con endpoint real
    return [
      { id: 'F-001', date: '2026-01-01', amount: 120.99, pdfUrl: '/static/invoices/F-001.pdf' },
      { id: 'F-002', date: '2026-01-05', amount: 89.50, pdfUrl: '/static/invoices/F-002.pdf' },
    ];
  }
};
