
import React, { useState, useEffect } from 'react';
import type { Reservacion, Evento } from '../types';
import api from '../services/api';
import paymentsApi from '../services/paymentsApi';
import { useKeycloak } from '../hooks/useKeycloak';

type Tab = 'reservaciones' | 'asistidos' | 'pagos';

const UserProfile: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('reservaciones');
  const [reservaciones, setReservaciones] = useState<Reservacion[]>([]);
  const [eventos, setEventos] = useState<Record<number, Evento>>({});
  const [pagos, setPagos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useKeycloak();

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;
      setLoading(true);
      try {
        const [reservacionesData, eventosData, pagosData] = await Promise.all([
          api.get<Reservacion[]>(`/reservaciones?usuarioId=${profile.id}`),
          api.get<Evento[]>(`/eventos`),
          paymentsApi.getUserPayments(profile.id)
        ]);
        setReservaciones(reservacionesData);
        setPagos(pagosData);
        const eventosMap = eventosData.reduce((acc, evento) => {
          acc[evento.id] = evento;
          return acc;
        }, {} as Record<number, Evento>);
        setEventos(eventosMap);
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile]);

  const renderContent = () => {
    if(loading) return <p>Cargando...</p>;

    switch (activeTab) {
      case 'reservaciones':
        const activas = reservaciones.filter(r => r.estado === 'CONFIRMADA' || r.estado === 'PENDIENTE');
        return activas.length > 0 ? (
          <div className="space-y-4">
            {activas.map(res => {
                const evento = eventos[res.eventoId];
                return (
                    <div key={res.id} className="bg-base-300 p-4 rounded-lg flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-lg">{evento?.nombre || 'Evento Desconocido'}</h3>
                            <p className="text-sm text-gray-400">Asientos: {res.asientos}</p>
                            <p className="text-sm text-gray-400">Fecha de compra: {new Date(res.fecha).toLocaleDateString()}</p>
                        </div>
                        <span className={`px-3 py-1 text-sm font-semibold rounded-full ${res.estado === 'CONFIRMADA' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                            {res.estado}
                        </span>
                    </div>
                );
            })}
          </div>
        ) : <p>No tienes reservaciones activas.</p>;
      case 'asistidos':
          const pasadas = reservaciones.filter(r => r.estado === 'PASADO');
          return pasadas.length > 0 ? (
             <div className="space-y-4">
                {pasadas.map(res => {
                    const evento = eventos[res.eventoId];
                    return (
                       <div key={res.id} className="bg-base-300 p-4 rounded-lg opacity-70">
                            <h3 className="font-bold text-lg">{evento?.nombre || 'Evento Desconocido'}</h3>
                            <p className="text-sm text-gray-400">Asistido</p>
                       </div>
                    );
                })}
            </div>
          ) : <p>Aún no has asistido a ningún evento.</p>;
      case 'pagos':
        if (loading) return <p>Cargando pagos...</p>;
        // Filtrar pagos que correspondan a las reservaciones del usuario actual
        const userReservationIds = reservaciones.map(r => r.id);
        // Solo pagos de reservaciones del usuario y propósito 'RESERVATION'
        const pagosFiltrados = pagos.filter(p =>
          p.reservationId &&
          userReservationIds.includes(p.reservationId) &&
          (p.purpose === 'RESERVATION' || p.Purpose === 'RESERVATION')
        );
        if (!pagosFiltrados || pagosFiltrados.length === 0) return <p>No tienes pagos registrados.</p>;
        return (
          <div className="space-y-4">
            {pagosFiltrados.map((pago) => {
              const reservacion = reservaciones.find(r => r.id === pago.reservationId);
              const evento = reservacion ? eventos[reservacion.eventoId] : undefined;
              return (
                <div key={pago.id} className="bg-base-300 p-4 rounded-lg flex flex-col md:flex-row md:justify-between md:items-center">
                  <div>
                    <h3 className="font-bold text-lg">{evento?.nombre || 'Evento Desconocido'}</h3>
                    <p className="text-sm text-gray-400">Reservación: #{reservacion?.id ?? 'N/A'}</p>
                    <p className="text-sm text-gray-400">Fecha de pago: {pago.date ? new Date(pago.date).toLocaleDateString() : 'N/A'}</p>
                    <p className="text-sm text-gray-400">Monto: <span className="font-semibold">${pago.amount?.toFixed(2) ?? 'N/A'}</span></p>
                  </div>
                  <div className="mt-2 md:mt-0">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${pago.state === 'APROBADO' ? 'bg-green-500/20 text-green-300' : pago.state === 'PENDIENTE' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'}`}>
                      {pago.state}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      default:
        return null;
    }
  };

  const TabButton = ({ tabId, label }: { tabId: Tab; label: string }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
        activeTab === tabId
          ? 'bg-base-200 text-primary border-b-2 border-primary'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-6">Mi Perfil</h1>
      <div className="w-full">
        <div className="border-b border-gray-700">
          <nav className="-mb-px flex space-x-4" aria-label="Tabs">
            <TabButton tabId="reservaciones" label="Mis Reservaciones" />
            <TabButton tabId="asistidos" label="Mis Eventos Asistidos" />
            <TabButton tabId="pagos" label="Mis Pagos" />
          </nav>
        </div>
        <div className="py-6 bg-base-200 p-6 rounded-b-lg">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
