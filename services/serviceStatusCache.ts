export type StoredServiceStatus = {
  serviceId: number;
  name: string;
  price: number;
  status: string;
  updatedAt?: string;
};

const STORAGE_KEY = 'reservation_service_statuses';

const hasStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readCache = (): Record<string, StoredServiceStatus[]> => {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, StoredServiceStatus[]>;
    }
    return {};
  } catch {
    return {};
  }
};

const writeCache = (map: Record<string, StoredServiceStatus[]>) => {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('[ServiceStatusCache] persist failed', err);
  }
};

export const getServiceStatusCache = () => readCache();

export const getReservationServiceStatuses = (reservationId: number | string) => {
  if (!reservationId) return undefined;
  const cache = readCache();
  return cache[String(reservationId)];
};

export const setReservationServiceStatuses = (
  reservationId: number | string,
  statuses: StoredServiceStatus[]
) => {
  if (!reservationId) return;
  const cache = readCache();
  cache[String(reservationId)] = statuses;
  writeCache(cache);
};

export const upsertReservationServiceStatus = (
  reservationId: number | string,
  status: StoredServiceStatus
) => {
  if (!reservationId || !status?.serviceId) return;
  const cache = readCache();
  const key = String(reservationId);
  const current = cache[key] ?? [];
  const idx = current.findIndex((s) => s.serviceId === status.serviceId);
  const updatedAt = status.updatedAt || new Date().toISOString();
  const nextRecord: StoredServiceStatus = {
    serviceId: status.serviceId,
    name: status.name || `Servicio #${status.serviceId}`,
    price: Number(isNaN(status.price) ? 0 : status.price),
    status: status.status || 'PENDING',
    updatedAt,
  };

  if (idx >= 0) {
    current[idx] = { ...current[idx], ...nextRecord };
  } else {
    current.push(nextRecord);
  }

  cache[key] = current;
  writeCache(cache);
  return current;
};

export const deleteReservationServiceStatuses = (reservationId: number | string) => {
  if (!reservationId) return;
  const cache = readCache();
  if (cache[String(reservationId)]) {
    delete cache[String(reservationId)];
    writeCache(cache);
  }
};
