import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import eventsApi from '../../services/eventsApi';
import type { Evento } from '../../types';
import { Button } from '../../components/ui/Button';

function formatEventDateTime(fecha?: string, hora?: string | null) {
  if (!fecha) return 'Fecha no disponible';
  try {
    const [y, m, d] = fecha.split('-').map(Number);
    let dt: Date;
    if (hora) {
      const [hh, mm] = hora.split(':').map(Number);
      dt = new Date(y, m - 1, d, hh ?? 0, mm ?? 0);
    } else {
      dt = new Date(y, m - 1, d);
    }
    return dt.toLocaleString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return fecha;
  }
}

export const EventManagementPage = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchEventos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await eventsApi.getEvents();
      // also load stages to display human-friendly stage names
      try {
        const stages = await eventsApi.getStages();
        const stageMap = new Map((stages || []).map((s: any) => [(s.Id ?? s.id), s]));
        // attach stage info to each event if possible
        const enriched = (data || []).map((ev: any) => ({ ...ev, _stage: stageMap.get(ev.stageId) }));
        setEventos(enriched);
      } catch (e) {
        setEventos(data);
      }
    } catch (error) {
      console.error('Error fetching eventos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const eventStatus = (ev: any) => {
    const isCancelled = ev.isCancelled;
    const isPublished = ev.isPublished;
    if (isCancelled === true) return { label: 'Cancelado', bg: 'bg-red-600', text: 'text-white' };
    if (isPublished === true) return { label: 'Publicado', bg: 'bg-green-600', text: 'text-white' };
    return { label: 'Creado', bg: 'bg-gray-500', text: 'text-white' };
  };

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer.')) {
      try {
        await eventsApi.deleteEvent(id);
        fetchEventos();
      } catch (error) {
        console.error('Error deleting evento:', error);
        if ((error as Error).message === 'SESSION_EXPIRED') {
          if (confirm('Tu sesión ha expirado. ¿Quieres iniciar sesión de nuevo?')) {
            // redirect to keycloak login
            (await import('../../services/keycloakService')).default.login();
          }
          return;
        }
      }
    }
  };

  if (loading) return <p>Cargando eventos...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gestión de Eventos</h1>
        <Button onClick={() => navigate('/admin/eventos/crear')} variant="primary">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Crear Nuevo Evento
        </Button>
      </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {eventos.map(evento => (
              <div key={evento.id} className="bg-base-200 rounded-lg overflow-hidden shadow-lg flex flex-col">
                <div className="relative">
                  <img className="w-full h-48 object-cover" src={(evento as any).posterUrl || `https://picsum.photos/seed/event-${evento.id}/800/400`} alt={evento.nombre} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  {/* Status badge */}
                  <div className="absolute top-3 right-3">
                    {(() => {
                      const st = eventStatus(evento as any);
                      return <span className={`px-3 py-1 rounded ${st.bg} ${st.text} font-semibold text-sm`}>{st.label}</span>;
                    })()}
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-grow">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-lg font-bold">{evento.nombre}</div>
                      <div className="text-sm text-gray-400">{formatEventDateTime(evento.fecha, evento.hora)}</div>
                    </div>
                    <div className="text-sm text-gray-500">{evento._stage ? (evento._stage.Name ?? evento._stage.name) : evento.ubicacion}</div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/eventos/${evento.id}/editar`)} aria-label="Editar evento">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 13.5V19h5.5L19.5 8.999l-5.5-5.5L4 13.5z" />
                      </svg>
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(evento.id)} aria-label="Eliminar evento">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
    </div>
  );
};
