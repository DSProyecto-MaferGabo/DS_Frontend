import React, { useEffect, useState } from "react";
import { getUserHistory } from "../../services/api";
import { useParams } from "react-router-dom";
import { Table, Spin, Alert } from "antd";

const columns = [
  { title: "Tipo", dataIndex: "type", key: "type" },
  { title: "Fecha", dataIndex: "date", key: "date" },
  { title: "Descripción", dataIndex: "description", key: "description" },
  { title: "Monto", dataIndex: "amount", key: "amount" },
  { title: "Estado", dataIndex: "status", key: "status" },
];

const simulatedHistory = [
  {
    id: 1,
    type: "Reserva",
    date: "2026-01-01",
    description: "Evento Concierto",
    amount: 120.99,
    status: "Confirmada",
  },
  {
    id: 2,
    type: "Pago",
    date: "2026-01-01",
    description: "Pago de reserva",
    amount: 120.99,
    status: "Aprobado",
  },
];

export default function UserHistoryPage() {
  const { userId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [simulated, setSimulated] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSimulated(false);
    getUserHistory(userId)
      .then((data) => {
        if (!data || data.length === 0) {
          setHistory(simulatedHistory);
          setSimulated(true);
        } else {
          setHistory(data);
        }
        setError(null);
      })
      .catch((err) => {
        setHistory(simulatedHistory);
        setSimulated(true);
        setError(null);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Spin />;

  return (
    <div>
      <h2>Historial de usuario</h2>
      {simulated && (
        <Alert
          type="info"
          message="Mostrando datos simulados. Conecta el backend para ver historial real."
          style={{ marginBottom: 16 }}
        />
      )}
      <Table columns={columns} dataSource={history} rowKey="id" />
    </div>
  );
}
