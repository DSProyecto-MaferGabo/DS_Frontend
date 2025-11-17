import React, { useEffect, useState } from 'react';
import { EventCard } from '../../components/client/EventCard';
import api from '../../services/api';
import type { Evento } from '../../types';

export const HomePage = () => {
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
      {/* Hero Section */}
      <div className="my-8 text-center bg-base-200 p-10 rounded-lg shadow-2xl bg-cover bg-center" style={{backgroundImage: "linear-gradient(rgba(17, 24, 39, 0.8), rgba(17, 24, 39, 0.8)), url('https://picsum.photos/seed/hero/1200/400')"}}>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">La Experiencia que Buscas, a un Click</h1>
        <p className="text-lg text-gray-300 mb-6 max-w-2xl mx-auto">Explora, descubre y compra entradas para los mejores eventos de la ciudad.</p>
        <div className="max-w-xl mx-auto">
            <input
                type="text"
                placeholder="Buscar por nombre de evento, artista o lugar..."
                className="w-full p-4 bg-base-100/80 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-lg"
            />
        </div>
      </div>

      {/* Eventos Destacados Section */}
      <div className="my-12">
        <h2 className="text-3xl font-bold text-white mb-6 border-l-4 border-primary pl-4">Eventos Destacados</h2>
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
    </div>
  );
};
