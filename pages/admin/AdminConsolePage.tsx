import React from "react";
import { Card, Button } from "antd";
import LanguageSelector from "../../components/LanguageSelector";

const resources = [
  { title: "Usuarios", link: "/admin/users", description: "Gestión de usuarios registrados" },
  { title: "Eventos", link: "/admin/eventos", description: "Gestión y edición de eventos" },
  { title: "Reservas", link: "/admin/reservations", description: "Control de reservas y asientos" },
  { title: "Pagos", link: "/admin/payments", description: "Revisión de pagos y facturas" },
  { title: "Servicios adicionales", link: "/admin/additional-services", description: "Contratación y estado de servicios" },
  { title: "Notificaciones", link: "/admin/email-notifications", description: "Envío y estado de notificaciones" },
  { title: "Encuestas", link: "/admin/survey-invitations", description: "Gestión de encuestas y respuestas" },
  { title: "Promociones", link: "/admin/promotions", description: "Códigos de descuento y reportes" },
  { title: "Logs de auditoría", link: "/admin/audit-logs", description: "Bitácora y monitoreo de acciones" },
  { title: "Panel de KPIs", link: "/admin/dashboard", description: "Indicadores clave y métricas" },
];

export default function AdminConsolePage() {
  return (
    <div style={{ maxWidth: 900, margin: "2rem auto" }}>
      <LanguageSelector />
      <h1 className="text-3xl font-bold mb-6">Consola Central de Administración</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {resources.map((r) => (
          <Card key={r.title} title={r.title} bordered>
            <p>{r.description}</p>
            <Button type="primary" href={r.link} style={{ marginTop: 12 }}>
              Ir a {r.title}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
