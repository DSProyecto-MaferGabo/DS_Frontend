import React from 'react';
import type { Evento } from '../types';
import { Button } from './ui/Button';

interface EventCardProps {
  evento?: Evento;
  event?: Evento;
  square?: boolean;
}

// Component accepts either `evento` or `event` prop to be more tolerant
export const EventCard: React.FC<EventCardProps> = ({ evento, event, square }) => {
  const e = evento ?? event;
  if (!e) return null;
  const buildDateTime = (fecha?: string, hora?: string | null) => {
    if (!fecha) return new Date();
    const [y, m, d] = fecha.split('-').map(Number);
    if (hora) {
      const [hh, mm] = (hora || '').split(':').map((s: any) => Number(s));
      return new Date(y, m - 1, d, hh ?? 0, mm ?? 0);
    }
    return new Date(y, m - 1, d);
  };

  const eventDate = buildDateTime(e.fecha, (e as any).hora ?? (e as any).time ?? (e as any).Time ?? null);
  const formattedDate = eventDate.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = eventDate.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const imageSrc = (e as any).imagen ?? (e as any).posterUrl ?? '';
  const ubicacion = (e as any).ubicacion ?? (e as any).location ?? 'Ubicación no disponible';

  return (
    <div className="bg-base-200 rounded-lg overflow-hidden shadow-lg hover:shadow-primary/50 transition-shadow duration-300 flex flex-col">
      <img className={`w-full object-cover ${square ? 'h-72' : 'h-48'}`} src={imageSrc} alt={e.nombre} />
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-xl font-bold text-white mb-2">{e.nombre}</h3>
        <p className="text-gray-400 text-sm mb-4 flex-grow">{e.descripcion}</p>
        <div className="text-sm text-gray-300 space-y-2 mb-4">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span>{formattedDate} - {formattedTime}</span>
          </div>
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span>{ubicacion}</span>
          </div>
          
        </div>
        <div className="mt-auto">
          <Button variant="primary" className="w-full">
            Ver Detalles
          </Button>
        </div>
      </div>
    </div>
  );
};
