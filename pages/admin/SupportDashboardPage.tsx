import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useKeycloak } from '../../hooks/useKeycloak';
import {
  ShieldCheckIcon,
  ArrowPathIcon,
  ServerStackIcon,
  UsersIcon,
  CalendarDaysIcon,
  TicketIcon,
  BoltIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { getAuditLogs, getPlatformStats } from '../../services/api';
import eventsApi from '../../services/eventsApi';
import type { AuditLogRecord, PlatformStats, EventRequest } from '../../types';

const LOG_LIMIT = 15;

export const SupportDashboardPage = () => {
  const { permissions, userRecord, refreshUserContext, isLoadingUserContext } = useKeycloak();
  const privilegeList = permissions?.privileges || [];

  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [requests, setRequests] = useState<EventRequest[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [lastLogsRefresh, setLastLogsRefresh] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const payload = await getPlatformStats();
      setStats(payload);
    } catch (err: any) {
      console.error('[SupportDashboard] stats error', err);
      setStatsError(describeError(err));
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    setLogsError(null);
    try {
      const response = await getAuditLogs({ limit: LOG_LIMIT });
      const normalized = Array.isArray(response)
        ? response
        : response?.items || response?.records || [];
      setLogs(normalized as AuditLogRecord[]);
      setLastLogsRefresh(new Date());
    } catch (err: any) {
      console.error('[SupportDashboard] logs error', err);
      setLogsError(describeError(err));
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true);
    setRequestsError(null);
    try {
      const data = await eventsApi.getPendingEventRequests();
      setRequests(data || []);
    } catch (err: any) {
      console.error('[SupportDashboard] pending requests error', err);
      setRequestsError('No se pudieron obtener las solicitudes pendientes.');
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchLogs();
    fetchRequests();
  }, [fetchLogs, fetchStats, fetchRequests]);

  const logStatus = useCallback((status?: string) => {
    if (!status) return 'Desconocido';
    return status;
  }, []);

  const statsCards = useMemo(() => ([
    { label: 'Usuarios totales', value: stats?.totalUsers, helper: 'Users-service', icon: UsersIcon },
    { label: 'Eventos activos', value: stats?.activeEvents, helper: 'Events-service', icon: CalendarDaysIcon },
    { label: 'Reservas del día', value: stats?.reservationsToday, helper: 'Reservations-service', icon: TicketIcon },
    { label: 'Errores críticos (24h)', value: stats?.criticalErrors24h, helper: 'Logs Mongo', icon: BoltIcon },
  ]), [stats]);

  const approveRequest = async (id: number) => {
    try {
      await eventsApi.approveEventRequest(id);
      await fetchRequests();
    } catch (err) {
      console.error('[SupportDashboard] approve error', err);
      setRequestsError('No se pudo aprobar la solicitud.');
    }
  };

  return (
    <section className="space-y-8">
      <header className="flex items-center gap-4">
        <div className="p-3 rounded-full bg-primary/20 text-primary">
          <ShieldCheckIcon className="w-10 h-10" />
        </div>
        <div>
          <p className="text-sm uppercase tracking-wide text-primary">Panel de Soporte</p>
          <h1 className="text-3xl font-semibold text-white">Bitácoras y privilegios en tiempo real</h1>
          <p className="text-gray-400 mt-1">Consulta tus permisos y los datos que llegan desde Users-service, Reservations-service y MongoDB.</p>
        </div>
      </header>

      <div className="bg-base-200 rounded-xl border border-base-300 shadow-lg">
        <div className="p-6 border-b border-base-300 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Privilegios asignados</h2>
            <p className="text-gray-400 text-sm">Rol actual: {permissions?.roleName || userRecord?.roleName || '—'}</p>
          </div>
          <button className="btn btn-outline btn-sm flex items-center gap-2" onClick={() => refreshUserContext()} disabled={isLoadingUserContext}>
            <ArrowPathIcon className={`w-4 h-4 ${isLoadingUserContext ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
        <div className="p-6">
          {privilegeList.length === 0 ? (
            <p className="text-gray-400">Aún no recibimos tus privilegios desde Users-service.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {privilegeList.map((priv) => (
                <li key={priv} className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold tracking-wide">
                  {priv}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statsCards.map(({ label, value, helper, icon: Icon }) => (
          <div key={label} className="bg-base-200 rounded-xl border border-base-300 shadow-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">{label}</p>
                <p className="text-3xl font-semibold text-white mt-2">
                  {loadingStats ? '...' : statsError ? 'N/D' : formatStatValue(value)}
                </p>
              </div>
              <div className="p-2 rounded-full bg-primary/20 text-primary">
                <Icon className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">{helper}</p>
          </div>
        ))}
      </div>
      {statsError && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-sm p-4 rounded-lg flex items-center gap-2">
          <ExclamationTriangleIcon className="w-5 h-5" />
          <span>{statsError}</span>
          <button className="btn btn-xs btn-outline ml-auto" onClick={fetchStats} disabled={loadingStats}>
            Reintentar
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-base-200 rounded-2xl border border-base-300 shadow-lg">
          <div className="p-6 border-b border-base-300 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Bitácora de auditoría</h2>
              <p className="text-sm text-gray-400">{loadingLogs ? 'Buscando registros en MongoDB...' : `${logs.length} registro(s) recientes`}</p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-outline btn-sm" onClick={fetchLogs} disabled={loadingLogs}>
                {loadingLogs ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>
          </div>
          {logsError ? (
            <div className="p-6 text-sm text-red-300 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5" />
              <span>{logsError}</span>
            </div>
          ) : loadingLogs ? (
            <div className="p-6 text-gray-400">Sincronizando con `EventsAuditDb`...</div>
          ) : logs.length === 0 ? (
            <div className="p-6 text-gray-400">Aún no hay registros para mostrar.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-base-300">
                <thead className="bg-base-300 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Microservicio</th>
                    <th className="px-4 py-3 text-left">Acción</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-300">
                  {logs.map((log) => (
                    <tr key={`${log.transactionId || log.id}-${log.timestamp}`}>
                      <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">{formatDate(log.timestamp)}</td>
                      <td className="px-4 py-3 text-sm text-gray-200">{log.microservice || '—'}</td>
                      <td className="px-4 py-3 text-sm text-white">
                        <p className="font-medium">{log.action}</p>
                        {log.details && (
                          <p className="text-xs text-gray-400 truncate max-w-xs">{summarizeDetails(log.details)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${statusTone(log.status)}`}>
                          {logStatus(log.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {lastLogsRefresh && !logsError && (
            <div className="p-4 border-t border-base-300 text-xs text-gray-500">
              Última actualización: {formatDate(lastLogsRefresh.toISOString())}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-base-200 rounded-2xl border border-base-300 p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <ServerStackIcon className="w-6 h-6 text-primary" />
              <div>
                <h3 className="text-lg font-semibold text-white">Estado de auditoría</h3>
                <p className="text-xs text-gray-400">MongoDB · `EventsAuditDb`</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Mantén activo el contenedor <code>mongo_audit</code> definido en `infra/docker-compose.mongo.yml`. Los servicios reportarán eventos críticos y administrativos en la colección `AuditLogs`.
            </p>
            <ul className="list-disc list-inside text-gray-400 text-sm space-y-2">
              <li>Usuarios: altas/bajas y cambios de rol.</li>
              <li>Eventos: creación, publicación, cancelación.</li>
              <li>Reservas: confirmaciones y fallos de pago.</li>
            </ul>
          </div>
          <div className="bg-base-200 rounded-2xl border border-base-300 p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Roadmap inmediato</h3>
            <p className="text-gray-400 text-sm">
              El equipo está exponiendo `GET /logs` y `GET /stats/dashboard` desde el ReportsController. En cuanto estén activos podrás filtrar por microservicio, usuario y severidad directamente desde este panel.
            </p>
            <p className="text-xs text-gray-500 mt-3">Mientras tanto puedes inspeccionar los documentos con <code>mongosh mongodb://localhost:27017/EventsAuditDb --eval "db.AuditLogs.find().limit(5)"</code>.</p>
          </div>

          <div className="bg-base-200 rounded-2xl border border-base-300 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Solicitudes pendientes</h3>
                <p className="text-xs text-gray-400">Aprobación por soporte/administrador</p>
              </div>
              <button className="btn btn-outline btn-xs" onClick={fetchRequests} disabled={loadingRequests}>
                {loadingRequests ? '...' : 'Actualizar'}
              </button>
            </div>
            {requestsError && <p className="text-sm text-red-300 mb-2">{requestsError}</p>}
            {loadingRequests ? (
              <p className="text-gray-400 text-sm">Cargando solicitudes...</p>
            ) : requests.length === 0 ? (
              <p className="text-gray-400 text-sm">Sin solicitudes pendientes.</p>
            ) : (
              <ul className="divide-y divide-base-300">
                {requests.map((req) => (
                  <li key={req.id} className="py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white font-semibold">{req.name}</p>
                      <p className="text-xs text-gray-400">{req.date}{req.time ? ` · ${req.time}` : ''} · Escenario {req.stageId}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{req.description}</p>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => approveRequest(req.id)}>
                      Aprobar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

function formatStatValue(value?: number | null) {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('es-MX');
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return value;
  }
}

function describeError(err: any) {
  if (err?.status === 404) {
    return 'El endpoint aún no está disponible. Publica ReportsController para habilitar esta vista.';
  }
  if (err?.status === 401) {
    return 'Sesión expirada. Inicia sesión nuevamente para ver los datos protegidos.';
  }
  return 'No pudimos recuperar la información. Revisa el servicio correspondiente.';
}

function summarizeDetails(details: Record<string, unknown>) {
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

function statusTone(status?: string) {
  if (!status) return 'bg-gray-500/20 text-gray-200';
  const normalized = status.toLowerCase();
  if (normalized.includes('success') || normalized.includes('ok')) {
    return 'bg-green-500/20 text-green-200';
  }
  if (normalized.includes('fail') || normalized.includes('error')) {
    return 'bg-red-500/20 text-red-200';
  }
  return 'bg-yellow-500/20 text-yellow-200';
}

export default SupportDashboardPage;
