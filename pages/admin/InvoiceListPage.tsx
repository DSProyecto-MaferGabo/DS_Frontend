import React, { useEffect, useState } from "react";
import paymentsApi from "../../services/paymentsApi";
import { Table, Button, Spin, Alert } from "antd";

const columns = [
  { title: "Factura", dataIndex: "id", key: "id" },
  { title: "Fecha", dataIndex: "date", key: "date" },
  { title: "Monto", dataIndex: "amount", key: "amount" },
  { title: "Descargar", key: "download", render: (_: any, record: any) => (
      <Button type="primary" href={record.pdfUrl} target="_blank">Descargar PDF</Button>
    ) },
];

const simulatedInvoices = [
  { id: 'F-001', date: '2026-01-01', amount: 120.99, pdfUrl: '/static/invoices/F-001.pdf' },
  { id: 'F-002', date: '2026-01-05', amount: 89.50, pdfUrl: '/static/invoices/F-002.pdf' },
];

export default function InvoiceListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [simulated, setSimulated] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSimulated(false);
    paymentsApi.getInvoices?.()
      .then(data => {
        if (!data || data.length === 0) {
          setInvoices(simulatedInvoices);
          setSimulated(true);
        } else {
          setInvoices(data);
        }
        setError(null);
      })
      .catch(err => {
        setInvoices(simulatedInvoices);
        setSimulated(true);
        setError(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin />;

  return (
    <div>
      <h2>Facturas generadas</h2>
      {simulated && (
        <Alert type="info" message="Mostrando datos simulados. Conecta el backend para ver facturas reales." style={{ marginBottom: 16 }} />
      )}
      <Table columns={columns} dataSource={invoices} rowKey="id" />
    </div>
  );
}
