import React, { useState, useEffect } from 'react';
import type { Reservacion, Evento } from '../../types';
import api from '../../services/api';
import { useKeycloak } from '../../hooks/useKeycloak';
import { Link } from 'react-router-dom';

type Tab = 'reservaciones' | 'asistidos' | 'pagos';

interface PopulatedReservacion extends Reservacion {
  evento?: Evento;
}

export const UserProfile = () => {
  const [activeTab, setActiveTab] = useState<Tab>('reservaciones');
  const [reservaciones, setReservaciones] = useState<PopulatedReservacion[]>([]);
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
        
        const eventosMap = new Map(eventosData.map(e => [e.id, e]));

        const populatedData = reservacionesData.map(res => ({
            ...res,
            evento: eventosMap.get(res.eventoId)
        }));

        setReservaciones(populatedData);

      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile]);

  const renderContent = () => {
    if(loading) return <div className="text-center p-8">Cargando tus datos...</div>;

    switch (activeTab) {
      case 'reservaciones':
        const activas = reservaciones.filter(r => new Date(r.evento?.fecha || 0) >= new Date());
        return activas.length > 0 ? (
          <div className="space-y-4">
            {activas.map(res => (
              <div key={res.id} className="bg-base-300 p-4 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center">
                <div className="mb-2 sm:mb-0">
                  <h3 className="font-bold text-lg text-white">{res.evento?.nombre || 'Evento Desconocido'}</h3>
                  <p className="text-sm text-gray-400">Fecha de compra: {new Date(res.fecha).toLocaleDateString()}</p>
                  <p className="text-sm text-gray-400">Total: ${res.total.toFixed(2)}</p>
                </div>
                <div className="flex items-center space-x-4">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${res.estado === 'CONFIRMADA' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                        {res.estado}
                    </span>
                    <Link to={`/evento/${res.eventoId}`} className="text-primary hover:underline text-sm">Ver Evento</Link>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-gray-400">No tienes reservaciones para eventos futuros.</p>;
      case 'asistidos':
          const pasadas = reservaciones.filter(r => new Date(r.evento?.fecha || 0) < new Date());
          return pasadas.length > 0 ? (
             <div className="space-y-4">
                {pasadas.map(res => (
                   <div key={res.id} className="bg-base-300 p-4 rounded-lg opacity-70 flex justify-between items-center">
                        <h3 className="font-bold text-lg">{res.evento?.nombre || 'Evento Desconocido'}</h3>
                        <span className="text-sm text-gray-500">Evento finalizado</span>
                   </div>
                ))}
            </div>
          ) : <p className="text-gray-400">Aún no has asistido a ningún evento.</p>;
      case 'pagos':
        return <p className="text-gray-400">Esta funcionalidad está en construcción.</p>;
      default:
        return null;
    }
  };

  const TabButton = ({ tabId, label }: { tabId: Tab; label:string }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors focus:outline-none ${
        activeTab === tabId
          ? 'bg-base-200 text-primary border-b-2 border-primary'
          : 'text-gray-400 hover:text-white hover:bg-base-300/50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-6 text-white">Mi Perfil</h1>
      <div className="w-full">
        <div className="border-b border-gray-700">
          <nav className="-mb-px flex space-x-2" aria-label="Tabs">
            <TabButton tabId="reservaciones" label="Mis Reservaciones" />
            <TabButton tabId="asistidos" label="Mis Eventos Asistidos" />
            <TabButton tabId="pagos" label="Mis Pagos" />
          </nav>
        </div>
        <div className="py-6 bg-base-200 p-6 rounded-b-lg min-h-[20rem]">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
