
import React, { useEffect, useState } from 'react';
import { EventCard } from '../components/EventCard';
import api from '../services/api';
import type { Evento } from '../types';

export const ClientDashboard = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEventos = async () => {
      try {
        const data = await api.get<Evento[]>('/eventos');
        setEventos(data);
      } catch (err) {
        setError('No se pudieron cargar los eventos. Intente de nuevo más tarde.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchEventos();
  }, []);

  return (
    <div className="container mx-auto px-4">
      <div className="my-8 bg-base-200 p-6 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-white mb-4">Encuentra tu Próximo Evento</h1>
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Buscar por nombre de evento..."
            className="flex-grow p-3 bg-base-300 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select className="p-3 bg-base-300 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
            <option>Todas las categorías</option>
            <option>Conciertos</option>
            <option>Conferencias</option>
            <option>Festivales</option>
          </select>
          <button className="bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-500 transition-colors">
            Buscar
          </button>
        </div>
      </div>

      {loading && <p className="text-center text-lg">Cargando eventos...</p>}
      {error && <p className="text-center text-lg text-red-400">{error}</p>}
      
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {eventos.map((evento) => (
            <EventCard key={evento.id} evento={evento} />
          ))}
        </div>
      )}
    </div>
  );
};
