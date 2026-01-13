import React from 'react';
import type { Evento, EventFormat } from '../types';
import { Button } from './ui/Button';

const FORMAT_LABELS: Record<EventFormat, string> = {
  presencial: 'Presencial',
  streaming: 'Streaming',
  hibrido: 'Híbrido',
};

const FORMAT_BADGE_CLASSES: Record<EventFormat, string> = {
  presencial: 'bg-emerald-500/90 text-black',
  streaming: 'bg-indigo-500 text-white',
  hibrido: 'bg-amber-400 text-black',
};

const POSTER_FALLBACK = 'https://picsum.photos/seed/ds-card/640/480';

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

  const rawPoster = (e as any).imagen ?? (e as any).posterUrl ?? '';
  const imageSrc = typeof rawPoster === 'string' && rawPoster.trim().length > 0 ? rawPoster : POSTER_FALLBACK;
  const ubicacion = (e as any).ubicacion ?? (e as any).location ?? 'Ubicación no disponible';
  const eventFormat = ((e as any).eventFormat ?? 'presencial') as EventFormat;

  return (
    <div className="bg-base-200 rounded-lg overflow-hidden shadow-lg hover:shadow-primary/50 transition-shadow duration-300 flex flex-col">
      <div className="relative">
        <img className={`w-full object-cover ${square ? 'h-72' : 'h-48'}`} src={imageSrc} alt={e.nombre} />
        <span className={`absolute top-3 left-3 text-xs tracking-wide font-semibold px-3 py-1 rounded-full shadow ${FORMAT_BADGE_CLASSES[eventFormat]}`}>
          {FORMAT_LABELS[eventFormat]}
        </span>
        {e.status && (
          <span className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold shadow ${
            e.status === 'PENDIENTE' ? 'bg-yellow-500 text-black' :
            e.status === 'RECHAZADO' ? 'bg-red-500 text-white' :
            e.status === 'APROBADO' ? 'bg-emerald-500 text-black' : 'bg-gray-500 text-white'
          }`}>
            {e.status === 'PENDIENTE' ? 'Por aprobar' : e.status === 'RECHAZADO' ? 'Rechazado' : e.status === 'APROBADO' ? 'Aprobado' : e.status}
          </span>
        )}
      </div>
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
