
import React, { useState, useEffect, useCallback } from 'react';
import eventsApi from '../../services/eventsApi';
import type { Evento, EventRequest, EventFormat } from '../../types';
import { Button } from '../../components/ui/Button';
import { EventCard } from '../../components/EventCard';

// A separate component for the modal form
const EventForm = ({
  evento,
  onClose,
  onSave,
}: {
  evento: Partial<Evento> | null;
  onClose: () => void;
  onSave: (evento: Partial<Evento>) => void;
}) => {
  const [formData, setFormData] = useState<Partial<Evento>>(
    evento || {
      nombre: '',
      fecha: '',
      ubicacion: '',
      descripcion: '',
      imagen: 'https://picsum.photos/seed/newevent/600/400',
    }
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-base-200 p-8 rounded-lg shadow-xl w-full max-w-2xl">
        <h2 className="text-2xl font-bold mb-6">{evento?.id ? 'Editar Evento' : 'Crear Evento'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" name="nombre" value={formData.nombre || ''} onChange={handleChange} placeholder="Nombre del Evento" className="w-full p-2 bg-base-300 rounded" required/>
          <input type="datetime-local" name="fecha" value={formData.fecha ? new Date(formData.fecha).toISOString().substring(0, 16) : ''} onChange={handleChange} className="w-full p-2 bg-base-300 rounded" required/>
          <input type="text" name="ubicacion" value={formData.ubicacion || ''} onChange={handleChange} placeholder="Ubicación" className="w-full p-2 bg-base-300 rounded" required/>
          <textarea name="descripcion" value={formData.descripcion || ''} onChange={handleChange} placeholder="Descripción" className="w-full p-2 bg-base-300 rounded" rows={4}></textarea>
          <div className="flex justify-end space-x-4 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary">Guardar</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const AdminEvents = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [pendingRequests, setPendingRequests] = useState<EventRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<Partial<Evento> | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [eventosData, pendingData] = await Promise.all([
        eventsApi.getAdminEvents(),
        eventsApi.getPendingEventRequests(),
      ]);
      setEventos(eventosData);
      setPendingRequests(pendingData);
    } catch (error) {
      console.error('Error fetching eventos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleCreate = () => {
    setSelectedEvento(null);
    setIsModalOpen(true);
  };

  const handleEdit = (evento: Evento) => {
    setSelectedEvento(evento);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este evento?')) {
      try {
        await api.delete(`/eventos/${id}`);
        fetchEventos();
      } catch (error) {
        console.error('Error deleting evento:', error);
      }
    }
  };

  const handleSave = async (eventoData: Partial<Evento>) => {
    try {
      if (eventoData.id) {
        await api.put(`/eventos/${eventoData.id}`, eventoData);
      } else {
        await api.post('/eventos', eventoData);
      }
      fetchEventos();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving evento:', error);
    }
  };

  if (loading) return <p>Cargando eventos...</p>;

  // Unir eventos y solicitudes pendientes en una sola lista
  const allEvents = [
    ...eventos.map(e => ({ ...e, status: 'APROBADO', categoryId: e.categoryId ?? 'Sin categoría' })),
    ...pendingRequests.map(r => ({
      id: r.id,
      nombre: r.name,
      descripcion: r.description,
      fecha: r.date,
      ubicacion: 'Por definir',
      posterUrl: '',
      eventFormat: r.eventFormat,
      categoryId: r.categoryId ?? 'Sin categoría',
      status: r.status,
      isPendingRequest: true,
    })),
  ];

  // Filtrado por estado y categoría
  const filteredEvents = allEvents.filter(e => {
    const statusMatch = filterStatus === 'all' || e.status === filterStatus;
    const categoryMatch = filterCategory === 'all' || String(e.categoryId) === filterCategory;
    return statusMatch && categoryMatch;
  });

  // Obtener categorías únicas
  const categories = Array.from(new Set(allEvents.map(e => String(e.categoryId))));

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">Gestión de Eventos</h1>
        <div className="flex gap-2 items-center">
          <label className="text-gray-300">Estado:</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-base-300 text-white rounded px-2 py-1">
            <option value="all">Todos</option>
            <option value="APROBADO">Aprobado</option>
            <option value="PENDIENTE">Por aprobar</option>
            <option value="RECHAZADO">Rechazado</option>
          </select>
          <label className="text-gray-300 ml-4">Categoría:</label>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-base-300 text-white rounded px-2 py-1">
            <option value="all">Todas</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <Button onClick={handleCreate} variant="primary">Crear Evento</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEvents.map(evento => (
          <div key={evento.id} className="relative">
            <EventCard evento={evento} />
            {evento.status === 'PENDIENTE' && (
              <span className="absolute top-3 right-3 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold shadow">Por aprobar</span>
            )}
            {evento.status === 'RECHAZADO' && (
              <span className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow">Rechazado</span>
            )}
            {evento.isPendingRequest && evento.status === 'PENDIENTE' && (
              <Button variant="success" className="absolute bottom-3 right-3" onClick={async () => {
                await eventsApi.approveEventRequest(evento.id);
                fetchAll();
              }}>Aprobar</Button>
            )}
          </div>
        ))}
      </div>
      {isModalOpen && <EventForm evento={selectedEvento} onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
    </div>
  );
};
