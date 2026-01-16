import React, { useEffect, useMemo, useState } from 'react';
import paymentsApi from '../../services/paymentsApi';
import eventsApi from '../../services/eventsApi';
import reservationsApi from '../../services/reservationsApi';
import { useKeycloak } from '../../hooks/useKeycloak';
import { Button } from '../../components/ui/Button';
import { useI18n } from '../../i18n';

type PaymentRow = {
  id: number;
  date?: string;
  amount?: number;
  state?: string;
  reservationId?: number;
  paymentMethodId?: number;
  purpose?: string;
  externalReference?: string;
  eventId?: number;
  eventName?: string;
};

const stateColor = (state?: string) => {
  const s = (state || '').toLowerCase();
  if (s.includes('approv') || s.includes('paid')) return 'text-green-300 bg-green-500/10';
  if (s.includes('reject') || s.includes('fail')) return 'text-red-300 bg-red-500/10';
  if (s.includes('pending') || s.includes('initiated')) return 'text-yellow-200 bg-yellow-500/10';
  return 'text-gray-200 bg-gray-600/30';
};

export const PaymentsAdminPage: React.FC = () => {
  const { keycloakInstance } = useKeycloak();
  const { t } = useI18n();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [stateFilter, setStateFilter] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [eventsById, setEventsById] = useState<Record<number, any>>({});
  const [methodNames, setMethodNames] = useState<Record<number, string>>({});
  const [methodFilter, setMethodFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const load = async () => {
      try {
        const isAdmin = keycloakInstance.hasRealmRole('administrador');
        const isOrganizer = keycloakInstance.hasRealmRole('organizador');

        // Load payments, reservations, events
        const [pays, reservations, myEvents, allEvents, methods] = await Promise.all([
          paymentsApi.getPayments().catch(() => []),
          reservationsApi.getReservations().catch(() => []),
          isOrganizer ? eventsApi.getMyEvents().catch(() => []) : [],
          isAdmin ? eventsApi.getEvents().catch(() => []) : [],
          paymentsApi.getPaymentMethods().catch(() => []),
        ]);

        const eventList = isAdmin ? allEvents : myEvents;
        const eventMap: Record<number, any> = {};
        (eventList || []).forEach((e: any) => {
          const id = Number(e.id ?? e.Id);
          if (id) eventMap[id] = e;
        });
        if (mounted) setEventsById(eventMap);

        // payment methods map
        const methodMap: Record<number, string> = {};
        (methods || []).forEach((m: any) => {
          const mid = Number(m.id ?? m.Id);
          if (mid) methodMap[mid] = m.type ?? m.Type ?? m.detail ?? `${mid}`;
        });
        if (mounted) setMethodNames(methodMap);

        // Map reservation -> eventId
        const resToEvent = new Map<number, number>();
        (reservations || []).forEach((r: any) => {
          const rid = Number(r.id ?? r.Id ?? r.reservationId ?? r.ReservationId);
          const ev = Number(r.eventoId ?? r.EventoId ?? r.eventId ?? r.EventId);
          if (rid && ev) resToEvent.set(rid, ev);
        });

        // Allowed events for organizer
        const allowedEventIds = new Set<number>(Object.keys(eventMap).map(k => Number(k)));

        const mapped = (pays as any[] || []).map((p: any) => {
          const id = p.id ?? p.paymentId ?? p.PaymentId;
          const reservationId = p.reservationId ?? p.ReservationId;
          const purpose = p.purpose ?? p.Purpose ?? '';
          const externalReference = p.externalReference ?? p.ExternalReference ?? '';
          let eventId: number | undefined;
          if (reservationId && resToEvent.has(Number(reservationId))) {
            eventId = resToEvent.get(Number(reservationId));
          } else if (purpose && String(purpose).toUpperCase().includes('PUBLICATION')) {
            const parsed = parseInt(String(externalReference), 10);
            if (!Number.isNaN(parsed)) eventId = parsed;
          }
          const eventName = eventId ? eventMap[eventId]?.nombre || eventMap[eventId]?.name || '' : '';
          return { ...p, id, reservationId, purpose, externalReference, eventId, eventName };
        });

        // Filter for organizer: only own events
        const finalList = (isAdmin ? mapped : mapped.filter(m => !m.eventId || allowedEventIds.has(Number(m.eventId))));
        if (mounted) setPayments(finalList);
      } catch (err) {
        console.error('No se pudieron cargar pagos', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [keycloakInstance]);

  const filtered = useMemo(() => {
    return payments.filter(p => {
      const st = (p.state || p.State || '').toString().toLowerCase();
      const purp = (p.purpose || p.Purpose || '').toString().toLowerCase();
      const method = String(p.paymentMethodId ?? (p as any).PaymentMethodId ?? '').toLowerCase();
      const evId = String(p.eventId ?? (p as any).EventId ?? '');
      const dateStr = p.date ?? (p as any).Date ?? (p as any).createdAt ?? '';
      const dateMs = dateStr ? Date.parse(dateStr) : NaN;
      const okState = !stateFilter || st.includes(stateFilter.toLowerCase());
      const okPurpose = !purposeFilter || purp.includes(purposeFilter.toLowerCase());
      const okMethod = !methodFilter || method.includes(methodFilter.toLowerCase());
      const okEvent = !eventFilter || evId === eventFilter;
      const okFrom = !fromDate || (!Number.isNaN(dateMs) && dateMs >= Date.parse(fromDate));
      const okTo = !toDate || (!Number.isNaN(dateMs) && dateMs <= Date.parse(toDate));
      return okState && okPurpose && okMethod && okEvent && okFrom && okTo;
    });
  }, [payments, stateFilter, purposeFilter, methodFilter, eventFilter, fromDate, toDate]);

  const summary = useMemo(() => {
    const agg = { total: 0, count: 0, approved: 0, pending: 0, failed: 0 };
    filtered.forEach(p => {
      const amount = Number(p.amount ?? (p as any).Amount ?? 0);
      agg.total += amount;
      agg.count += 1;
      const s = (p.state ?? (p as any).State ?? '').toString().toLowerCase();
      if (s.includes('approv') || s.includes('paid') || s.includes('confirm')) agg.approved += 1;
      else if (s.includes('reject') || s.includes('fail')) agg.failed += 1;
      else agg.pending += 1;
    });
    return agg;
  }, [filtered]);

  const exportCsv = () => {
    const headers = ['id', 'date', 'amount', 'state', 'purpose', 'reservationId', 'paymentMethod', 'externalReference', 'eventId', 'eventName'];
    const rows = filtered.map(p => {
      const id = p.id ?? (p as any).paymentId ?? (p as any).PaymentId ?? '';
      const date = p.date ?? (p as any).Date ?? (p as any).createdAt ?? '';
      const amount = Number(p.amount ?? (p as any).Amount ?? 0);
      const state = p.state ?? (p as any).State ?? '';
      const purpose = p.purpose ?? (p as any).Purpose ?? '';
      const reservationId = p.reservationId ?? (p as any).ReservationId ?? '';
      const pm = p.paymentMethodId ?? (p as any).PaymentMethodId ?? '';
      const pmName = methodNames[Number(pm)] ?? pm ?? '';
      const ext = p.externalReference ?? (p as any).ExternalReference ?? '';
      const evId = p.eventId ?? (p as any).EventId ?? '';
      const evName = p.eventName ?? eventsById[evId]?.nombre ?? eventsById[evId]?.name ?? '';
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
    link.download = 'payments.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('payments.admin.title')}</h1>
          <p className="text-gray-400">{t('payments.admin.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input input-bordered bg-base-200 text-sm"
            placeholder={t('payments.admin.filter.state')}
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
          />
          <input
            className="input input-bordered bg-base-200 text-sm"
            placeholder={t('payments.admin.filter.purpose')}
            value={purposeFilter}
            onChange={e => setPurposeFilter(e.target.value)}
          />
          <input
            className="input input-bordered bg-base-200 text-sm"
            placeholder={t('payments.admin.filter.method')}
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
          />
          <select
            className="select select-bordered bg-base-200 text-sm"
            value={eventFilter}
            onChange={e => setEventFilter(e.target.value)}
          >
            <option value="">{t('payments.admin.filter.event')}</option>
            {Object.entries(eventsById).map(([id, ev]) => (
              <option key={id} value={id}>{ev.nombre || ev.name || `#${id}`}</option>
            ))}
          </select>
          <input
            type="date"
            className="input input-bordered bg-base-200 text-sm"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            placeholder={t('payments.admin.filter.from')}
          />
          <input
            type="date"
            className="input input-bordered bg-base-200 text-sm"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            placeholder={t('payments.admin.filter.to')}
          />
          <button className="btn btn-outline btn-sm" onClick={exportCsv}>{t('payments.admin.export')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title={t('payments.admin.stat.total')} value={`$${summary.total.toFixed(2)}`} />
        <StatCard title={t('payments.admin.stat.count')} value={`${summary.count}`} />
        <StatCard title={t('payments.admin.stat.approved')} value={`${summary.approved}`} />
        <StatCard title={t('payments.admin.stat.pending')} value={`${summary.pending}`} />
        <StatCard title={t('payments.admin.stat.failed')} value={`${summary.failed}`} />
      </div>

      {loading ? (
        <div className="text-gray-300">{t('payments.admin.loading')}</div>
      ) : (
        <div className="overflow-x-auto bg-base-200 rounded-lg">
          <table className="table">
            <thead>
              <tr className="text-gray-400 text-sm">
                <th>{t('payments.admin.table.id')}</th>
                <th>{t('payments.admin.table.date')}</th>
                <th>{t('payments.admin.table.amount')}</th>
                <th>{t('payments.admin.table.state')}</th>
                <th>{t('payments.admin.table.purpose')}</th>
                <th>{t('payments.admin.table.reservationId')}</th>
                <th>{t('payments.admin.table.method')}</th>
                <th>{t('payments.admin.table.reference')}</th>
                <th>{t('payments.admin.table.eventId')}</th>
                <th>{t('payments.admin.table.event')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const id = p.id ?? (p as any).paymentId ?? (p as any).PaymentId;
                const date = p.date ?? (p as any).Date ?? (p as any).createdAt ?? '';
                const amount = Number(p.amount ?? (p as any).Amount ?? 0);
                const state = p.state ?? (p as any).State ?? '';
                const purpose = p.purpose ?? (p as any).Purpose ?? '';
                const reservationId = p.reservationId ?? (p as any).ReservationId ?? '';
                const pm = p.paymentMethodId ?? (p as any).PaymentMethodId ?? '';
                const ext = p.externalReference ?? (p as any).ExternalReference ?? '';
                const evId = p.eventId ?? (p as any).EventId;
                const evName = p.eventName ?? eventsById[evId]?.nombre ?? eventsById[evId]?.name ?? '';
                const pmName = methodNames[Number(pm)] ?? pm ?? '—';
                return (
                  <tr key={id} className="border-base-300">
                    <td className="text-white font-mono">{id}</td>
                    <td className="text-gray-300">{date ? new Date(date).toLocaleString() : '—'}</td>
                    <td className="text-white font-semibold">${amount.toFixed(2)}</td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${stateColor(state)}`}>
                        {state || '—'}
                      </span>
                    </td>
                    <td className="text-gray-300">{purpose || '—'}</td>
                    <td className="text-gray-300">{reservationId || '—'}</td>
                    <td className="text-gray-300">{pmName}</td>
                    <td className="text-gray-400 text-xs">{ext || '—'}</td>
                    <td className="text-gray-300">{evId || '—'}</td>
                    <td className="text-gray-200">{evName || '—'}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-gray-400 py-4">{t('payments.admin.empty')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PaymentsAdminPage;

const StatCard = ({ title, value }: { title: string; value: string }) => (
  <div className="bg-base-200 rounded-xl p-3 shadow border border-base-300">
    <div className="text-gray-400 text-sm">{title}</div>
    <div className="text-xl font-semibold text-white mt-1">{value}</div>
  </div>
);
