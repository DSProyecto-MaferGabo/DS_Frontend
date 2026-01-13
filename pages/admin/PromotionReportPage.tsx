import React, { useEffect, useState } from "react";
import eventsApi from "../../services/eventsApi";
import { Table, Spin, Alert } from "antd";

const columns = [
  { title: "Código", dataIndex: "code", key: "code" },
  { title: "Descripción", dataIndex: "description", key: "description" },
  { title: "Usos", dataIndex: "redemptions", key: "redemptions" },
  { title: "Vigencia", dataIndex: "validUntil", key: "validUntil" },
];

const simulatedPromos = [
  { code: 'PROMO10', description: '10% de descuento', redemptions: 25, validUntil: '2026-02-01' },
  { code: 'PROMO20', description: '20% de descuento', redemptions: 12, validUntil: '2026-03-01' },
];

export default function PromotionReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promos, setPromos] = useState<any[]>([]);
  const [simulated, setSimulated] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSimulated(false);
    eventsApi.getPromotionReport?.()
      .then(data => {
        if (!data || data.length === 0) {
          setPromos(simulatedPromos);
          setSimulated(true);
        } else {
          setPromos(data);
        }
        setError(null);
      })
      .catch(err => {
        setPromos(simulatedPromos);
        setSimulated(true);
        setError(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin />;

  return (
    <div>
      <h2>Reporte de promociones</h2>
      {simulated && (
        <Alert type="info" message="Mostrando datos simulados. Conecta el backend para ver reportes reales." style={{ marginBottom: 16 }} />
      )}
      <Table columns={columns} dataSource={promos} rowKey="code" />
    </div>
  );
}
