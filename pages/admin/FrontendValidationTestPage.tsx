import React, { useState } from "react";
import { getUserHistory } from "../../services/api";
import notificationsApi from "../../services/notificationsApi";
import paymentsApi from "../../services/paymentsApi";
import { Button, Alert, Spin } from "antd";

export default function FrontendValidationTestPage() {
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [facturaStatus, setFacturaStatus] = useState<string | null>(null);
  const [notiStatus, setNotiStatus] = useState<string | null>(null);

  const handleTestHistory = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await getUserHistory(userId || "1");
      if (!Array.isArray(data)) throw new Error("El historial no es un array");
      setResult(data.length ? "OK" : "Sin datos");
    } catch (err: any) {
      setError(err?.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleTestFactura = async () => {
    setFacturaStatus(null);
    try {
      // Simula consulta de factura PDF (ajusta endpoint real si existe)
      const res = await paymentsApi.getPaymentMethods();
      setFacturaStatus(res ? "OK" : "Sin datos");
    } catch (err: any) {
      setFacturaStatus("Error: " + (err?.message || "desconocido"));
    }
  };

  const handleTestNotificacion = async () => {
    setNotiStatus(null);
    try {
      await notificationsApi.sendGeneralEmail({
        to: "test@example.com",
        subject: "Prueba",
        body: "Esto es una prueba automática."
      });
      setNotiStatus("OK");
    } catch (err: any) {
      setNotiStatus("Error: " + (err?.message || "desconocido"));
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "2rem auto" }}>
      <h2>Validación automática de flujos</h2>
      <div>
        <label>userId: </label>
        <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="userId" />
        <Button onClick={handleTestHistory} disabled={loading || !userId} style={{ marginLeft: 8 }}>
          Probar historial
        </Button>
      </div>
      {loading && <Spin />}
      {result && <Alert type="success" message={"Historial: " + result} />}
      {error && <Alert type="error" message={error} />}
      <div style={{ marginTop: 24 }}>
        <Button onClick={handleTestFactura}>Probar consulta de factura</Button>
        {facturaStatus && <Alert type={facturaStatus.startsWith("OK") ? "success" : "error"} message={"Factura: " + facturaStatus} />}
      </div>
      <div style={{ marginTop: 24 }}>
        <Button onClick={handleTestNotificacion}>Probar envío de notificación</Button>
        {notiStatus && <Alert type={notiStatus.startsWith("OK") ? "success" : "error"} message={"Notificación: " + notiStatus} />}
      </div>
    </div>
  );
}
