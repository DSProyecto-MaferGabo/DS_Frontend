import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import eventsApi from '../../services/eventsApi';
import { Button } from '../../components/ui/Button';
import type { Evento } from '../../types';

export const EventEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [evento, setEvento] = useState<Partial<Evento> | null>(null);
  const [loading, setLoading] = useState(true);
  const [zonas, setZonas] = useState<any[]>([]);
  const [seats, setSeats] = useState<any[]>([]);
  const [stageId, setStageId] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await eventsApi.getEvent(Number(id));
        setEvento(data);
        const sId = (data as any).stageId ?? null;
        setStageId(sId);
        if (sId) {
          const result = await eventsApi.getSeats(sId);
          setSeats(result.seats);
          // annotate original name for change detection
          setZonas(result.zonas.map((z: any) => ({ ...z, _originalName: z.nombre })));
        }
      } catch (err) {
        console.error(err);
      } finally { setLoading(false); }
    };
    fetch();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEvento(prev => ({ ...(prev || {}), [name]: value }));
  };

  const handleSave = async () => {
    if (!id || !evento) return;
    try {
      await eventsApi.updateEvent(Number(id), {
        name: evento.nombre || 'Evento',
        description: evento.descripcion || '',
        date: (evento.fecha || new Date().toISOString().slice(0,10)),
        stageId: stageId ?? 1,
      });
      // If zonas were edited, propagate name changes to seats in backend
      if (zonas && zonas.length > 0) {
        // zonas: [{ id, nombre, precio }]
        // For each zona, find seats that reference it and update their zone name if changed
        const updatePromises: Promise<any>[] = [];
        for (const z of zonas) {
          if (!z._originalName || z._originalName === z.nombre) continue;
          // find seats with zonaId === z.id
          const affected = seats.filter(s => s.zonaId === z.id);
          for (const s of affected) {
            if (!s.rawId) continue;
            updatePromises.push(eventsApi.updateSeat(s.rawId, { row_number: s.fila, seatnumber: parseInt(s.numero || '1'), zone: z.nombre, StageId: s.escenarioId }));
          }
        }
        if (updatePromises.length > 0) await Promise.all(updatePromises);
      }
      alert('Evento actualizado');
      // refresh
      const refreshed = await eventsApi.getEvent(Number(id));
      setEvento(refreshed);
      if (stageId) {
        const r = await eventsApi.getSeats(stageId);
        setSeats(r.seats);
        setZonas(r.zonas);
      }
      navigate('/admin/eventos');
    } catch (err) { console.error(err); alert('Error al actualizar'); }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm('¿Eliminar evento?')) return;
    try {
      await eventsApi.deleteEvent(Number(id));
      navigate('/admin/eventos');
    } catch (err) { console.error(err); alert('Error al eliminar'); }
  };

  const handlePublish = async () => {
    if (!id) return;
    try { await eventsApi.publishEvent(Number(id)); alert('Evento publicado'); setLoading(true); const d = await eventsApi.getEvent(Number(id)); setEvento(d); setLoading(false);} catch (err) { console.error(err); alert('Error al publicar'); }
  };

  const handleCancel = async () => {
    if (!id) return;
    try { await eventsApi.cancelEvent(Number(id)); alert('Evento cancelado'); setLoading(true); const d = await eventsApi.getEvent(Number(id)); setEvento(d); setLoading(false);} catch (err) { console.error(err); alert('Error al cancelar'); }
  };

  if (loading) return <p>Cargando evento...</p>;
  if (!evento) return <p>Evento no encontrado</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Editar Evento</h1>
      <div className="bg-base-200 p-6 rounded-lg mb-6">
        <label className="block mb-2 font-semibold">Nombre</label>
        <input name="nombre" value={evento.nombre || ''} onChange={handleChange} className="w-full p-2 bg-base-300 rounded mb-4" />
        <label className="block mb-2 font-semibold">Fecha</label>
        <input name="fecha" type="date" value={evento.fecha ? evento.fecha.substring(0,10) : ''} onChange={handleChange} className="w-full p-2 bg-base-300 rounded mb-4" />
        <label className="block mb-2 font-semibold">Ubicación</label>
        <input name="ubicacion" value={evento.ubicacion || ''} onChange={handleChange} className="w-full p-2 bg-base-300 rounded mb-4" />
        <label className="block mb-2 font-semibold">Descripción</label>
        <textarea name="descripcion" value={evento.descripcion || ''} onChange={handleChange} className="w-full p-2 bg-base-300 rounded mb-4" rows={4} />

        <div className="flex gap-2">
          <Button onClick={handleSave} variant="primary">Guardar</Button>
          <Button onClick={handlePublish} variant="secondary">Publicar</Button>
          <Button onClick={handleCancel} variant="ghost">Cancelar</Button>
          <Button onClick={handleDelete} variant="danger">Eliminar</Button>
        </div>
      </div>
      <div className="bg-base-200 p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">Zonas y Precios</h2>
        {zonas.length === 0 ? (
          <p className="text-gray-400">No se encontraron zonas para este escenario.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {zonas.map(z => (
              <div key={z.id} className="p-4 bg-base-300 rounded">
                <label className="block text-sm font-medium">Nombre</label>
                <input className="w-full p-2 bg-base-200 rounded mb-2" value={z.nombre} onChange={e => setZonas(prev => prev.map(x => x.id === z.id ? { ...x, nombre: e.target.value } : x))} />
                <label className="block text-sm font-medium">Precio</label>
                <input type="number" className="w-full p-2 bg-base-200 rounded" value={z.precio ?? 100} onChange={e => setZonas(prev => prev.map(x => x.id === z.id ? { ...x, precio: parseFloat(e.target.value || '0') } : x))} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
