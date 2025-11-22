import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import eventsApi from '../../services/eventsApi';
import type { Evento } from '../../types';
import { Button } from '../../components/ui/Button';

export const EventManagementPage = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchEventos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await eventsApi.getEvents();
      setEventos(data);
    } catch (error) {
      console.error('Error fetching eventos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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
          Crear Nuevo Evento
        </Button>
      </div>
      <div className="bg-base-200 shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-base-300">
            <tr>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm">Nombre</th>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm">Fecha</th>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm">Ubicación</th>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm">Acciones</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {eventos.map((evento) => (
              <tr key={evento.id} className="border-b border-base-300 hover:bg-base-300/50">
                <td className="py-3 px-4 font-semibold">{evento.nombre}</td>
                <td className="py-3 px-4">{new Date(evento.fecha).toLocaleString('es-ES')}</td>
                <td className="py-3 px-4">{evento.ubicacion}</td>
                <td className="py-3 px-4">
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/eventos/${evento.id}/editar`)}>Editar</Button>
                    <Button onClick={() => handleDelete(evento.id)} variant="danger" size="sm">Eliminar</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
