import React, { useEffect, useMemo, useState } from 'react';
import paymentsApi from '../../services/paymentsApi';

type BillingReport = {
  TotalAmount: number;
  PaymentCount: number;
  MonthlyReport: { Year: number; Month: number; TotalAmount: number; PaymentCount: number }[];
};

export const ReportsAdminPage: React.FC = () => {
  const [report, setReport] = useState<BillingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [month, setMonth] = useState<number | undefined>(undefined);

  const loadReport = () => {
    setLoading(true);
    paymentsApi.getBillingReport(year, month)
      .then(data => setReport(data as any))
      .catch(err => {
        console.error('No se pudo cargar el reporte de facturación', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
  }, []);

  const monthly = useMemo(() => report?.MonthlyReport ?? [], [report]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Reportes</h1>
          <p className="text-gray-400">Facturación por mes (basado en /Bill/report)</p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            className="input input-bordered bg-base-200 w-28 text-sm"
            placeholder="Año"
            value={year ?? ''}
            onChange={e => setYear(e.target.value ? Number(e.target.value) : undefined)}
          />
          <input
            type="number"
            className="input input-bordered bg-base-200 w-24 text-sm"
            placeholder="Mes"
            value={month ?? ''}
            onChange={e => setMonth(e.target.value ? Number(e.target.value) : undefined)}
          />
          <button className="btn btn-primary btn-sm" onClick={loadReport} disabled={loading}>
            {loading ? 'Cargando...' : 'Aplicar'}
          </button>
        </div>
      </div>

      {loading && <div className="text-gray-300">Cargando reporte...</div>}

      {!loading && report && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Total facturado" value={`$${(report.TotalAmount ?? 0).toFixed(2)}`} />
            <StatCard title="Pagos registrados" value={`${report.PaymentCount ?? 0}`} />
            <StatCard title="Meses reportados" value={`${monthly.length}`} />
          </div>

          <div className="overflow-x-auto bg-base-200 rounded-lg">
            <table className="table">
              <thead>
                <tr className="text-gray-400 text-sm">
                  <th>Año</th>
                  <th>Mes</th>
                  <th>Total</th>
                  <th>Pagos</th>
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
                    <td colSpan={4} className="text-center text-gray-400 py-4">Sin datos</td>
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
