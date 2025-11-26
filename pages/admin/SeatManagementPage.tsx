import React, { useEffect, useState } from 'react';
import eventsApi from '../../services/eventsApi';
import { Button } from '../../components/ui/Button';

export const SeatManagementPage = () => {
  const [seats, setSeats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ id: '', escenarioId: '', zonaId: '', fila: '', numero: '', estado: 'disponible', precio: '' });

  const fetch = async () => {
    setLoading(true);
    try { const data = await eventsApi.getSeats(); setSeats(data.seats); /* we could also use data.zonas */ } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleCreate = async () => {
    try {
      // Map form to backend AddSeatDto
  await eventsApi.createSeat({ row_number: form.fila, seatnumber: parseInt(form.numero || '1'), zone: form.zonaId || 'General', StageId: Number(form.escenarioId), price: parseFloat(form.precio || '0') });
  setForm({ id: '', escenarioId: '', zonaId: '', fila: '', numero: '', estado: 'disponible', precio: '' });
      fetch();
    } catch (err) { console.error(err); alert('Error al crear asiento'); }
  };

  const handleDelete = async (rawId: number) => {
    if (!confirm('¿Eliminar asiento?')) return;
    try { await eventsApi.deleteSeat(rawId); fetch(); } catch (err) { console.error(err); }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Gestión de Asientos</h1>

      <div className="bg-base-200 p-4 rounded mb-6">
        <div className="grid grid-cols-4 gap-2 mb-4">
          <input placeholder="ID (p.ej. 1-R1-1)" value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} className="p-2 bg-base-300 rounded" />
          <input placeholder="EscenarioId" value={form.escenarioId} onChange={e => setForm({ ...form, escenarioId: e.target.value })} className="p-2 bg-base-300 rounded" />
          <input placeholder="ZonaId" value={form.zonaId} onChange={e => setForm({ ...form, zonaId: e.target.value })} className="p-2 bg-base-300 rounded" />
          <input placeholder="Fila" value={form.fila} onChange={e => setForm({ ...form, fila: e.target.value })} className="p-2 bg-base-300 rounded" />
          <input placeholder="Numero" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} className="p-2 bg-base-300 rounded" />
          <input placeholder="Precio" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} className="p-2 bg-base-300 rounded" />
          <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="p-2 bg-base-300 rounded">
            <option value="disponible">disponible</option>
            <option value="ocupado">ocupado</option>
            <option value="seleccionado">seleccionado</option>
          </select>
        </div>
        <Button onClick={handleCreate} variant="primary">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Crear Asiento
        </Button>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Asientos existentes</h2>
        {loading ? <p>Cargando...</p> : (
          <ul className="space-y-2">
            {seats.map(s => (
              <li key={s.id} className="p-2 bg-base-200 rounded flex justify-between items-center">
                <div>
                  <div className="font-semibold">{s.id}</div>
                  <div className="text-sm text-gray-400">Escenario {s.escenarioId} · Zona {s.zonaId} · {s.fila}{s.numero}</div>
                </div>
                <div>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(s.rawId)} aria-label={`Eliminar asiento ${s.id}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6" />
                    </svg>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
