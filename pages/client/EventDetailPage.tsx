import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import eventsApi from '../../services/eventsApi';
import type { Evento } from '../../types';
import { Button } from '../../components/ui/Button';
import { CalendarIcon, MapPinIcon } from '@heroicons/react/24/solid';

export const EventDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvento = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await eventsApi.getEvent(Number(id));
        setEvento(data);
      } catch (error) {
        console.error("Error fetching event details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvento();
  }, [id]);

  if (loading) return <div className="text-center p-10">Cargando evento...</div>;
  if (!evento) return <div className="text-center p-10">Evento no encontrado.</div>;

  const eventDate = new Date(evento.fecha);
  const formattedDate = eventDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedTime = eventDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <img src={evento.posterUrl} alt={evento.nombre} className="rounded-lg shadow-2xl w-full object-cover" />
        </div>
        <div className="md:col-span-2">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">{evento.nombre}</h1>
          <p className="text-lg text-gray-300 mb-6">{evento.descripcion}</p>
          
          <div className="bg-base-200/50 p-6 rounded-lg mb-6 space-y-4">
            <div className="flex items-center text-lg">
                <CalendarIcon className="w-6 h-6 mr-3 text-primary"/>
                <span>{formattedDate} a las {formattedTime}</span>
            </div>
            <div className="flex items-center text-lg">
                <MapPinIcon className="w-6 h-6 mr-3 text-primary"/>
                <span>{evento.ubicacion}</span>
            </div>
          </div>

          <div className="mt-8">
             <Link to={`/evento/${id}/asientos`}>
                <Button size="lg" variant="primary" className="w-full md:w-auto shadow-lg hover:shadow-primary/50 transform hover:scale-105">
                    Comprar Entradas
                </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
