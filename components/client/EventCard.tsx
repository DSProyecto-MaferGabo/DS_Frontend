import React from 'react';
import { Link } from 'react-router-dom';
import type { Evento } from '../../types';
import { CalendarIcon, MapPinIcon } from '@heroicons/react/24/solid';

interface EventCardProps {
  evento: Evento;
}

export const EventCard: React.FC<EventCardProps> = ({ evento }) => {
  const eventDate = new Date(evento.fecha);
  const formattedDate = eventDate.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Link to={`/evento/${evento.id}`} className="block group">
      <div className="bg-base-200 rounded-lg overflow-hidden shadow-lg hover:shadow-primary/50 transition-all duration-300 transform hover:-translate-y-1 flex flex-col h-full">
        <div className="relative">
            <img className="w-full h-80 object-cover" src={evento.posterUrl} alt={evento.nombre} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        </div>
        <div className="p-6 flex flex-col flex-grow">
          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors">{evento.nombre}</h3>
          <div className="text-sm text-gray-400 space-y-2 mt-auto">
            <div className="flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2 text-secondary" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center">
              <MapPinIcon className="h-5 w-5 mr-2 text-secondary" />
              <span>{evento.ubicacion}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
