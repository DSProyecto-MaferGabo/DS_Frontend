import React from 'react';
import { Link } from 'react-router-dom';
import type { Evento, EventFormat } from '../../types';
import { CalendarIcon, MapPinIcon } from '@heroicons/react/24/solid';

const MEDIA_PUBLIC_BASE = import.meta.env.VITE_MEDIA_PUBLIC_BASE_URL || '';
const POSTER_FALLBACK = 'https://picsum.photos/seed/ds-poster/720/480';

interface EventCardProps {
  evento: Evento;
}

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

export const EventCard: React.FC<EventCardProps> = ({ evento }) => {
  // Parse fecha (YYYY-MM-DD) as a local date to avoid timezone shifts when using new Date(string)
  let formattedDate = '';
  try {
    const [yStr, mStr, dStr] = String(evento.fecha || '').split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (y && m && d) {
      const localDate = new Date(y, m - 1, d);
      formattedDate = localDate.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
  } catch (err) {
    // fallback to original parsing if something unexpected happens
    try {
      const eventDate = new Date(evento.fecha as any);
      formattedDate = eventDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      formattedDate = String(evento.fecha ?? '');
    }
  }
  // Format time if available
  const formattedTime = evento.hora ? (() => {
    try {
      // hora may be 'HH:mm' or 'HH:mm:ss'
      const parts = evento.hora.split(':');
      const hh = parts[0].padStart(2, '0');
      const mm = (parts[1] || '00').padStart(2, '0');
      return `${hh}:${mm}`;
    } catch {
      return String(evento.hora);
    }
  })() : null;

  const eventFormat = ((evento as any).eventFormat ?? 'presencial') as EventFormat;

  const resolvePosterUrl = () => {
    const poster = (evento as any).posterUrl || (evento as any).PosterUrl || (evento as any).poster || '';
    if (poster && /^https?:\/\//i.test(poster)) return poster;
    if (poster && MEDIA_PUBLIC_BASE) return `${MEDIA_PUBLIC_BASE.replace(/\/+$/, '')}/${poster.replace(/^\/+/, '')}`;
    return POSTER_FALLBACK;
  };

  return (
    <Link to={`/evento/${evento.id}`} className="block group">
      <div className="bg-base-200 rounded-lg overflow-hidden shadow-lg hover:shadow-primary/50 transition-all duration-300 transform hover:-translate-y-1 flex flex-col h-full">
        <div className="relative">
            <img className="w-full h-80 object-cover" src={resolvePosterUrl()} alt={evento.nombre} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <span className={`absolute top-3 left-3 z-10 text-xs tracking-wide font-semibold px-3 py-1 rounded-full shadow ${FORMAT_BADGE_CLASSES[eventFormat]}`}>
              {FORMAT_LABELS[eventFormat]}
            </span>
        </div>
        <div className="p-6 flex flex-col flex-grow">
          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors">{evento.nombre}</h3>
          <div className="text-sm text-gray-400 space-y-2 mt-auto">
            <div className="flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2 text-secondary" />
              <span>{formattedDate}{formattedTime ? ` • ${formattedTime}` : ''}</span>
            </div>
            <div className="flex items-center">
              <MapPinIcon className="h-5 w-5 mr-2 text-secondary" />
              <span>{evento.ubicacion || 'Ubicación no definida'}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
