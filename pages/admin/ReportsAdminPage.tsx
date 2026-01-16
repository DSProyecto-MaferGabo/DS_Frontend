import React, { useEffect, useMemo, useState } from 'react';
import paymentsApi from '../../services/paymentsApi';
import eventsApi from '../../services/eventsApi';
import reservationsApi from '../../services/reservationsApi';
import { useKeycloak } from '../../hooks/useKeycloak';
import { useI18n } from '../../i18n';

type BillingReport = {
  TotalAmount: number;
  PaymentCount: number;
  MonthlyReport: { Year: number; Month: number; TotalAmount: number; PaymentCount: number }[];
};

type Aggregated = {
  totalAmount: number;
  count: number;
  approved: number;
  pending: number;
  failed: number;
};

type EventAggregate = Aggregated & { eventId: number; eventName: string };
type MethodAggregate = Aggregated & { methodId: number | string; methodName: string };

const classify = (state: string) => {
  const s = (state || '').toLowerCase();
  if (s.includes('approv') || s.includes('paid') || s.includes('confirm')) return 'approved';
  if (s.includes('reject') || s.includes('fail')) return 'failed';
  return 'pending';
};

export const ReportsAdminPage: React.FC = () => {
  const { keycloakInstance } = useKeycloak();
  const { t } = useI18n();

  const [report, setReport] = useState<BillingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [month, setMonth] = useState<number | undefined>(undefined);

  const [payments, setPayments] = useState<any[]>([]);
  const [eventsById, setEventsById] = useState<Record<number, any>>({});
  const [methodNames, setMethodNames] = useState<Record<number, string>>({});
  const [stateFilter, setStateFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadReport = () => {
    setLoading(true);
    paymentsApi.getBillingReport(year, month)
      .then(data => setReport(data as any))
      .catch(err => {
        console.error('No se pudo cargar el reporte de facturación', err);
      })
      .finally(() => setLoading(false));
  };

  const loadAgg = async () => {
    setLoading(true);
    try {
      const isAdmin = keycloakInstance.hasRealmRole('administrador');
      const isOrganizer = keycloakInstance.hasRealmRole('organizador');

      const [pays, reservations, myEvents, allEvents, methods] = await Promise.all([
        paymentsApi.getPayments().catch(() => []),
        reservationsApi.getReservations().catch(() => []),
        isOrganizer ? eventsApi.getMyEvents().catch(() => []) : [],
        isAdmin ? eventsApi.getEvents().catch(() => []) : [],
        paymentsApi.getPaymentMethods().catch(() => [])
      ]);

      const eventList = isAdmin ? allEvents : myEvents;
      const eventMap: Record<number, any> = {};
      (eventList || []).forEach((e: any) => {
        const id = Number(e.id ?? e.Id);
        if (id) eventMap[id] = e;
      });
      setEventsById(eventMap);

      const methodMap: Record<number, string> = {};
      (methods || []).forEach((m: any) => {
        const id = Number(m.id ?? m.Id);
        if (id) methodMap[id] = m.type ?? m.Type ?? m.detail ?? `${id}`;
      });
      setMethodNames(methodMap);

      const resToEvent = new Map<number, number>();
      (reservations || []).forEach((r: any) => {
        const rid = Number(r.id ?? r.Id ?? r.reservationId ?? r.ReservationId);
        const ev = Number(r.eventoId ?? r.EventoId ?? r.eventId ?? r.EventId);
        if (rid && ev) resToEvent.set(rid, ev);
      });

      const allowedEventIds = new Set<number>(Object.keys(eventMap).map(k => Number(k)));

      const mapped = (pays as any[] || []).map((p: any) => {
        const id = p.id ?? p.paymentId ?? p.PaymentId;
        const reservationId = p.reservationId ?? p.ReservationId;
        const purpose = p.purpose ?? p.Purpose ?? '';
        const externalReference = p.externalReference ?? p.ExternalReference ?? '';
        const state = p.state ?? p.State ?? '';
        const amount = Number(p.amount ?? p.Amount ?? 0);
        const methodId = p.paymentMethodId ?? p.PaymentMethodId;
        let eventId: number | undefined;
        if (reservationId && resToEvent.has(Number(reservationId))) {
          eventId = resToEvent.get(Number(reservationId));
        } else if (purpose && String(purpose).toUpperCase().includes('PUBLICATION')) {
          const parsed = parseInt(String(externalReference), 10);
          if (!Number.isNaN(parsed)) eventId = parsed;
        }
        return { id, reservationId, purpose, externalReference, state, amount, methodId, eventId };
      });

      const filteredPays = isAdmin ? mapped : mapped.filter(m => !m.eventId || allowedEventIds.has(Number(m.eventId)));
      setPayments(filteredPays);
    } catch (err) {
      console.error('No se pudo cargar el agregado de pagos', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(); // billing report (mensual)
    loadAgg();    // agregados por evento y método
  }, []);

  const filteredPays = useMemo(() => {
    return payments.filter(p => {
      const st = (p.state ?? '').toString().toLowerCase();
      const evId = p.eventId ? String(p.eventId) : '';
      const okState = !stateFilter || st.includes(stateFilter.toLowerCase());
      const okEvent = !eventFilter || evId === eventFilter;
      const dateStr = (p as any).date ?? (p as any).Date ?? (p as any).createdAt ?? '';
      const dateMs = dateStr ? Date.parse(dateStr) : NaN;
      const okFrom = !fromDate || (!Number.isNaN(dateMs) && dateMs >= Date.parse(fromDate));
      const okTo = !toDate || (!Number.isNaN(dateMs) && dateMs <= Date.parse(toDate));
      return okState && okEvent && okFrom && okTo;
    });
  }, [payments, stateFilter, eventFilter, fromDate, toDate]);

  const aggregations = useMemo(() => {
    const agg: Aggregated = { totalAmount: 0, count: 0, approved: 0, pending: 0, failed: 0 };
    const eventAggMap = new Map<number, EventAggregate>();
    const methodAggMap = new Map<number | string, MethodAggregate>();

    filteredPays.forEach(p => {
      const status = classify(p.state);
      agg.count += 1;
      agg.totalAmount += p.amount || 0;
      agg[status as keyof Aggregated] += 1;

      const evId = p.eventId ? Number(p.eventId) : 0;
      if (evId) {
        if (!eventAggMap.has(evId)) {
          eventAggMap.set(evId, {
            eventId: evId,
            eventName: eventsById[evId]?.nombre || eventsById[evId]?.name || `Evento #${evId}`,
            totalAmount: 0,
            count: 0,
            approved: 0,
            pending: 0,
            failed: 0
          });
        }
        const evAgg = eventAggMap.get(evId)!;
        evAgg.count += 1;
        evAgg.totalAmount += p.amount || 0;
        evAgg[status as keyof Aggregated] += 1;
      }

      const mid = p.methodId ?? 'desconocido';
      if (!methodAggMap.has(mid)) {
        methodAggMap.set(mid, {
          methodId: mid,
          methodName: methodNames[mid as number] || `${mid}`,
          totalAmount: 0,
          count: 0,
          approved: 0,
          pending: 0,
          failed: 0
        });
      }
      const mAgg = methodAggMap.get(mid)!;
      mAgg.count += 1;
      mAgg.totalAmount += p.amount || 0;
      mAgg[status as keyof Aggregated] += 1;
    });

    return {
      globalAgg: agg,
      byEvent: Array.from(eventAggMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
      byMethod: Array.from(methodAggMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
    };
  }, [filteredPays, eventsById, methodNames]);

  const { globalAgg, byEvent, byMethod } = aggregations;
  const monthly = useMemo(() => report?.MonthlyReport ?? [], [report]);

  const exportCsv = () => {
    const headers = ['id', 'date', 'amount', 'state', 'purpose', 'reservationId', 'paymentMethod', 'externalReference', 'eventId', 'eventName'];
    const rows = filteredPays.map(p => {
      const id = p.id ?? p.paymentId ?? p.PaymentId ?? '';
      const date = (p as any).date ?? (p as any).Date ?? (p as any).createdAt ?? '';
      const amount = Number(p.amount ?? p.Amount ?? 0);
      const state = p.state ?? p.State ?? '';
      const purpose = p.purpose ?? p.Purpose ?? '';
      const reservationId = p.reservationId ?? p.ReservationId ?? '';
      const pm = p.methodId ?? p.paymentMethodId ?? p.PaymentMethodId ?? '';
      const pmName = methodNames[Number(pm)] ?? pm ?? '';
      const ext = p.externalReference ?? p.ExternalReference ?? '';
      const evId = p.eventId ?? p.EventId ?? '';
      const evName = eventsById[evId]?.nombre || eventsById[evId]?.name || '';
      return [id, date, amount.toFixed(2), state, purpose, reservationId, pmName, ext, evId, evName];
    });
    const csv = [headers, ...rows]
      .map(r => r.map(field => {
        const v = field ?? '';
        if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))) {
          return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      }).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'report-payments.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('reports.admin.title')}</h1>
          <p className="text-gray-400">{t('reports.admin.subtitle')}</p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            className="input input-bordered bg-base-200 w-28 text-sm"
            placeholder={t('reports.admin.year')}
            value={year ?? ''}
            onChange={e => setYear(e.target.value ? Number(e.target.value) : undefined)}
          />
          <input
            type="number"
            className="input input-bordered bg-base-200 w-24 text-sm"
            placeholder={t('reports.admin.month')}
            value={month ?? ''}
            onChange={e => setMonth(e.target.value ? Number(e.target.value) : undefined)}
          />
          <button className="btn btn-primary btn-sm" onClick={loadReport} disabled={loading}>
            {loading ? t('reports.admin.loading') : t('reports.admin.apply')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="input input-bordered bg-base-200 text-sm"
          placeholder={t('reports.admin.filter.state')}
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
        />
        <select
          className="select select-bordered bg-base-200 text-sm"
          value={eventFilter}
          onChange={e => setEventFilter(e.target.value)}
        >
          <option value="">{t('reports.admin.filter.event')}</option>
          {Object.entries(eventsById).map(([id, ev]) => (
            <option key={id} value={id}>{ev.nombre || ev.name || `#${id}`}</option>
          ))}
        </select>
        <input
          type="date"
          className="input input-bordered bg-base-200 text-sm"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          placeholder={t('reports.admin.filter.from')}
        />
        <input
          type="date"
          className="input input-bordered bg-base-200 text-sm"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          placeholder={t('reports.admin.filter.to')}
        />
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>{t('reports.admin.export')}</button>
      </div>

      {loading && <div className="text-gray-300">{t('reports.admin.loading')}</div>}

      {/* Estadísticas globales */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard title={t('reports.admin.stat.total')} value={`$${(globalAgg.totalAmount ?? 0).toFixed(2)}`} />
          <StatCard title={t('reports.admin.stat.count')} value={`${globalAgg.count}`} />
          <StatCard title={t('reports.admin.stat.approved')} value={`${globalAgg.approved}`} />
          <StatCard title={t('reports.admin.stat.pending')} value={`${globalAgg.pending}`} />
          <StatCard title={t('reports.admin.stat.failed')} value={`${globalAgg.failed}`} />
        </div>
      )}

      {/* Tabla por evento */}
      {!loading && byEvent.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white">{t('reports.admin.byEvent')}</h2>
          <div className="overflow-x-auto bg-base-200 rounded-lg">
            <table className="table">
              <thead>
                <tr className="text-gray-400 text-sm">
                  <th>{t('reports.admin.table.event')}</th>
                  <th>{t('reports.admin.table.total')}</th>
                  <th>{t('reports.admin.table.payments')}</th>
                  <th>{t('reports.admin.table.approved')}</th>
                  <th>{t('reports.admin.table.pending')}</th>
                  <th>{t('reports.admin.table.failed')}</th>
                </tr>
              </thead>
              <tbody>
                {byEvent.map(ev => (
                  <tr key={ev.eventId} className="border-base-300">
                    <td className="text-white">{ev.eventName || `Evento #${ev.eventId}`}</td>
                    <td className="text-white font-semibold">${ev.totalAmount.toFixed(2)}</td>
                    <td className="text-gray-300">{ev.count}</td>
                    <td className="text-green-300">{ev.approved}</td>
                    <td className="text-yellow-200">{ev.pending}</td>
                    <td className="text-red-300">{ev.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabla por método de pago */}
      {!loading && byMethod.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white">{t('reports.admin.byMethod')}</h2>
          <div className="overflow-x-auto bg-base-200 rounded-lg">
            <table className="table">
              <thead>
                <tr className="text-gray-400 text-sm">
                  <th>{t('reports.admin.table.method')}</th>
                  <th>{t('reports.admin.table.total')}</th>
                  <th>{t('reports.admin.table.payments')}</th>
                  <th>{t('reports.admin.table.approved')}</th>
                  <th>{t('reports.admin.table.pending')}</th>
                  <th>{t('reports.admin.table.failed')}</th>
                </tr>
              </thead>
              <tbody>
                {byMethod.map(m => (
                  <tr key={m.methodId} className="border-base-300">
                    <td className="text-white">{m.methodName || m.methodId}</td>
                    <td className="text-white font-semibold">${m.totalAmount.toFixed(2)}</td>
                    <td className="text-gray-300">{m.count}</td>
                    <td className="text-green-300">{m.approved}</td>
                    <td className="text-yellow-200">{m.pending}</td>
                    <td className="text-red-300">{m.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reporte mensual existente */}
      {!loading && report && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">{t('reports.admin.monthlyTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title={t('reports.admin.monthly.total')} value={`$${(report.TotalAmount ?? 0).toFixed(2)}`} />
            <StatCard title={t('reports.admin.monthly.count')} value={`${report.PaymentCount ?? 0}`} />
            <StatCard title={t('reports.admin.monthly.months')} value={`${monthly.length}`} />
          </div>

          <div className="overflow-x-auto bg-base-200 rounded-lg">
            <table className="table">
              <thead>
                <tr className="text-gray-400 text-sm">
                  <th>{t('reports.admin.monthly.year')}</th>
                  <th>{t('reports.admin.monthly.month')}</th>
                  <th>{t('reports.admin.table.total')}</th>
                  <th>{t('reports.admin.table.payments')}</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m, idx) => (
                  <tr key={`${m.Year}-${m.Month}-${idx}`} className="border-base-300">
                    <td className="text-white">{m.Year}</td>
                    <td className="text-white">{m.Month}</td>
                    <td className="text-white font-semibold">${Number(m.TotalAmount ?? 0).toFixed(2)}</td>
                    <td className="text-gray-300">{m.PaymentCount}</td>
                  </tr>
                ))}
                {monthly.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-gray-400 py-4">{t('reports.admin.monthly.empty')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value }: { title: string; value: string }) => (
  <div className="bg-base-200 rounded-xl p-4 shadow border border-base-300">
    <div className="text-gray-400 text-sm">{title}</div>
    <div className="text-2xl font-semibold text-white mt-1">{value}</div>
  </div>
);

export default ReportsAdminPage;
