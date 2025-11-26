import React, { useEffect, useState } from 'react';
import { EventCard } from '../../components/client/EventCard';
import eventsApi from '../../services/eventsApi';
import type { Evento } from '../../types';

export const HomePage = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  useEffect(() => {
    const fetchEventos = async () => {
      try {
        const data = await eventsApi.getEvents();
        // Filter out events that have already finished (date + optional time)
        const now = new Date();
        const upcoming = (data || []).filter((e: any) => {
          if (!e || !e.fecha) return false;
          try {
            // Parse fecha (YYYY-MM-DD) and hora (HH:mm:ss) into local Date parts
            const [yStr, mStr, dStr] = String(e.fecha).split('-');
            const year = Number(yStr);
            const month = Number(mStr);
            const day = Number(dStr);
            if (!year || !month || !day) return false;

            // Build date-only and compare with today's local date first
            const eventDateOnly = new Date(year, month - 1, day);
            const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (eventDateOnly < todayDateOnly) return false; // strictly past date
            if (eventDateOnly > todayDateOnly) return true; // future date (regardless of time)

            // If we reach here, the event is scheduled for today -> evaluate time (if present)
            let hour = 0;
            let minute = 0;
            let second = 0;
            if (e.hora) {
              const parts = String(e.hora).split(':').map(p => Number(p));
              if (parts.length >= 1 && !isNaN(parts[0])) hour = parts[0];
              if (parts.length >= 2 && !isNaN(parts[1])) minute = parts[1];
              if (parts.length >= 3 && !isNaN(parts[2])) second = parts[2];
            } else {
              // No hora -> treat as still available today (so set to end of day)
              hour = 23; minute = 59; second = 59;
            }
            const dt = new Date(year, month - 1, day, hour, minute, second);
            if (isNaN(dt.getTime())) return false;
            // Defensive logging: if event date is before today but passes, log details
            if (eventDateOnly < todayDateOnly && dt >= now) {
              console.warn('Event with past date passed the upcoming filter', { evento: e, parsed: dt.toString(), now: now.toString() });
            }
            return dt >= now;
          } catch (err) {
            console.warn('Error parsing event date/time', err, e);
            return false;
          }
        });
        setEventos(upcoming);
        // fetch categories for filter
        try {
          const cats = await eventsApi.getCategories();
          setCategories(cats || []);
        } catch (e) {
          console.warn('Could not load categories for filter', e);
        }
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
                placeholder="Buscar por nombre de evento o lugar..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full p-4 bg-base-100/80 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-lg"
            />
        </div>
      </div>

      {/* Eventos Destacados Section */}
      <div className="my-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-white border-l-4 border-primary pl-4">Eventos Destacados</h2>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-300 mr-2">Filtrar por categoría</label>
            <select value={selectedCategory ?? ''} onChange={e => setSelectedCategory(e.target.value ? Number(e.target.value) : null)} className="p-2 bg-base-200 text-sm rounded">
              <option value="">Todas</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        {loading && <p className="text-center text-lg">Cargando eventos...</p>}
        {error && <p className="text-center text-lg text-red-400">{error}</p>}
        
        {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {eventos
              .filter(e => {
                // category filter
                if (selectedCategory && Number(e.categoryId) !== Number(selectedCategory)) return false;
                // search filter
                if (!searchTerm) return true;
                const q = searchTerm.toLowerCase();
                return (e.nombre || '').toLowerCase().includes(q) || (e.ubicacion || '').toLowerCase().includes(q) || (e.descripcion || '').toLowerCase().includes(q);
              })
              .map((evento) => (
                <EventCard key={evento.id} evento={evento} />
            ))}
            </div>
        )}
      </div>
    </div>
  );
};
