import React, { useEffect, useMemo, useState } from 'react';
import paymentsApi from '../../services/paymentsApi';
import { Button } from '../../components/ui/Button';

type PaymentRow = {
  id: number;
  date?: string;
  amount?: number;
  state?: string;
  reservationId?: number;
  paymentMethodId?: number;
  purpose?: string;
  externalReference?: string;
};

const stateColor = (state?: string) => {
  const s = (state || '').toLowerCase();
  if (s.includes('approv') || s.includes('paid')) return 'text-green-300 bg-green-500/10';
  if (s.includes('reject') || s.includes('fail')) return 'text-red-300 bg-red-500/10';
  if (s.includes('pending') || s.includes('initiated')) return 'text-yellow-200 bg-yellow-500/10';
  return 'text-gray-200 bg-gray-600/30';
};

export const PaymentsAdminPage: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [stateFilter, setStateFilter] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    paymentsApi.getPayments()
      .then(data => {
        if (!mounted) return;
        setPayments((data as any[]) || []);
      })
      .catch(err => {
        console.error('No se pudieron cargar pagos', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    return payments.filter(p => {
      const st = (p.state || p.State || '').toString().toLowerCase();
      const purp = (p.purpose || p.Purpose || '').toString().toLowerCase();
      const okState = !stateFilter || st.includes(stateFilter.toLowerCase());
      const okPurpose = !purposeFilter || purp.includes(purposeFilter.toLowerCase());
      return okState && okPurpose;
    });
  }, [payments, stateFilter, purposeFilter]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Pagos</h1>
          <p className="text-gray-400">Pagos registrados en el sistema</p>
        </div>
        <div className="flex gap-2">
          <input
            className="input input-bordered bg-base-200 text-sm"
            placeholder="Filtrar estado (approved/pending/rejected)"
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
          />
          <input
            className="input input-bordered bg-base-200 text-sm"
            placeholder="Filtrar propósito (RESERVATION/PUBLICATION)"
            value={purposeFilter}
            onChange={e => setPurposeFilter(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-gray-300">Cargando pagos...</div>
      ) : (
        <div className="overflow-x-auto bg-base-200 rounded-lg">
          <table className="table">
            <thead>
              <tr className="text-gray-400 text-sm">
                <th>ID</th>
                <th>Fecha</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Propósito</th>
                <th>ReservaId</th>
                <th>Método</th>
                <th>Ref externa</th>
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
                    <td className="text-gray-300">{pm || '—'}</td>
                    <td className="text-gray-400 text-xs">{ext || '—'}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 py-4">Sin pagos coincidentes.</td>
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
