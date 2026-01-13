import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Table, Spin, Alert } from "antd";

const columns = [
  { title: "Fecha", dataIndex: "timestamp", key: "timestamp" },
  { title: "Usuario", dataIndex: "user", key: "user" },
  { title: "Acción", dataIndex: "action", key: "action" },
  { title: "Servicio", dataIndex: "microservice", key: "microservice" },
  { title: "Nivel", dataIndex: "level", key: "level" },
  { title: "Datos", dataIndex: "data", key: "data", render: (data: any) => <pre>{JSON.stringify(data, null, 2)}</pre> },
];

const simulatedLogs = [
  {
    timestamp: '2026-01-09T10:00:00Z',
    user: 'admin',
    action: 'CREATE_EVENT',
    microservice: 'Events-service',
    level: 'INFO',
    data: { eventId: 'EVT-001', name: 'Concierto' },
  },
  {
    timestamp: '2026-01-09T10:05:00Z',
    user: 'organizer1',
    action: 'CONFIRM_RESERVATION',
    microservice: 'Reservations-service',
    level: 'INFO',
    data: { reservationId: 'RES-123', seats: 2 },
  },
];

export default function AuditLogPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [simulated, setSimulated] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSimulated(false);
    api.getAuditLogs?.()
      .then(data => {
        const realLogs = Array.isArray(data) ? data : data.items || [];
        if (realLogs.length === 0) {
          setLogs(simulatedLogs);
          setSimulated(true);
        } else {
          setLogs(realLogs);
        }
        setError(null);
      })
      .catch(err => {
        setLogs(simulatedLogs);
        setSimulated(true);
        setError(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin />;

  return (
    <div>
      <h2>Logs de auditoría</h2>
      {simulated && (
        <Alert type="info" message="Mostrando datos simulados. Conecta el backend para ver logs reales." style={{ marginBottom: 16 }} />
      )}
      <Table columns={columns} dataSource={logs} rowKey="timestamp" />
    </div>
  );
}
