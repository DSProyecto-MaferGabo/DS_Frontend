
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import type { Evento } from '../../types';
import { Button } from '../../components/ui/Button';

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
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<Partial<Evento> | null>(null);

  const fetchEventos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Evento[]>('/eventos');
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gestión de Eventos</h1>
        <Button onClick={handleCreate} variant="primary">Crear Evento</Button>
      </div>
      <div className="bg-base-200 shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-base-300">
            <tr>
              <th className="text-left py-3 px-4">Nombre</th>
              <th className="text-left py-3 px-4">Fecha</th>
              <th className="text-left py-3 px-4">Ubicación</th>
              <th className="text-left py-3 px-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((evento) => (
              <tr key={evento.id} className="border-b border-base-300 hover:bg-base-300/50">
                <td className="py-3 px-4">{evento.nombre}</td>
                <td className="py-3 px-4">{new Date(evento.fecha).toLocaleString()}</td>
                <td className="py-3 px-4">{evento.ubicacion}</td>
                <td className="py-3 px-4">
                  <div className="flex space-x-2">
                    <Button onClick={() => handleEdit(evento)} variant="ghost" size="sm">Editar</Button>
                    <Button onClick={() => handleDelete(evento.id)} variant="danger" size="sm">Eliminar</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && <EventForm evento={selectedEvento} onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
    </div>
  );
};
