
import React, { useState, useEffect } from 'react';
import type { Reservacion, Evento } from '../types';
import api from '../services/api';
import { useKeycloak } from '../hooks/useKeycloak';

type Tab = 'reservaciones' | 'asistidos' | 'pagos';

export const UserProfile = () => {
  const [activeTab, setActiveTab] = useState<Tab>('reservaciones');
  const [reservaciones, setReservaciones] = useState<Reservacion[]>([]);
  const [eventos, setEventos] = useState<Record<number, Evento>>({});
  const [loading, setLoading] = useState(true);
  const { profile } = useKeycloak();
  
  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;
      setLoading(true);
      try {
        const [reservacionesData, eventosData] = await Promise.all([
          api.get<Reservacion[]>(`/reservaciones?usuarioId=${profile.id}`),
          api.get<Evento[]>(`/eventos`),
        ]);
        
        setReservaciones(reservacionesData);

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
        return <p>Esta funcionalidad está en construcción.</p>;
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
