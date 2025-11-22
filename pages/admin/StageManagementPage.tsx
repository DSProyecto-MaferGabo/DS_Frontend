import React, { useEffect, useState } from 'react';
import eventsApi from '../../services/eventsApi';
import { Button } from '../../components/ui/Button';

export const StageManagementPage = () => {
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await eventsApi.getStages();
      setStages(data);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleCreate = async () => {
    try {
      await eventsApi.createStage({ name, peoplecapacity: 100, location: name });
      setName('');
      fetch();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar escenario?')) return;
    try { await eventsApi.deleteStage(id); fetch(); } catch (err) { console.error(err); }
  };

  const startEdit = (s: any) => { setEditingId(s.id); setEditName(s.name); };
  const cancelEdit = () => { setEditingId(null); setEditName(''); };
  const saveEdit = async (id: number) => {
    try {
      await eventsApi.updateStage(id, { name: editName, peoplecapacity: 100, location: editName });
      cancelEdit();
      fetch();
    } catch (err) { console.error(err); }
  };

  if (loading) return <p>Cargando escenarios...</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Gestión de Escenarios</h1>
      <div className="mb-6 flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del escenario" className="p-2 bg-base-300 rounded" />
        <Button onClick={handleCreate}>Crear</Button>
      </div>
      <ul className="space-y-2">
        {stages.map(s => (
          <li key={s.id} className="p-3 bg-base-200 rounded flex justify-between items-center">
            <div>
              {editingId === s.id ? (
                <div>
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="p-2 bg-base-300 rounded mb-2" />
                  <div className="text-sm text-gray-400">Capacidad: {s.peoplecapacity} · {s.location}</div>
                </div>
              ) : (
                <>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-gray-400">Capacidad: {s.peoplecapacity} · {s.location}</div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {editingId === s.id ? (
                <>
                  <Button onClick={() => saveEdit(s.id)} variant="primary">Guardar</Button>
                  <Button onClick={cancelEdit} variant="ghost">Cancelar</Button>
                </>
              ) : (
                <>
                  <Button onClick={() => startEdit(s)} variant="ghost">Editar</Button>
                  <Button variant="danger" onClick={() => handleDelete(s.id)}>Eliminar</Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
