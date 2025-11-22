import React, { useEffect, useState } from 'react';
import eventsApi from '../../services/eventsApi';
import { Button } from '../../components/ui/Button';

export const PromotionManagementPage = () => {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState<number>(10);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editDiscount, setEditDiscount] = useState<number>(10);

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await eventsApi.getPromotions();
      setPromos(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleCreate = async () => {
    try {
      await eventsApi.createPromotion({ code, discount });
      setCode(''); setDiscount(10);
      fetch();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar promoción?')) return;
    try { await eventsApi.deletePromotion(id); fetch(); } catch (err) { console.error(err); }
  };

  const startEdit = (p: any) => { setEditingId(p.id); setEditCode(p.code); setEditDiscount(p.discount); };
  const cancelEdit = () => { setEditingId(null); setEditCode(''); setEditDiscount(10); };
  const saveEdit = async (id: number) => {
    try { await eventsApi.updatePromotion(id, { code: editCode, discount: editDiscount }); cancelEdit(); fetch(); } catch (err) { console.error(err); }
  };

  if (loading) return <p>Cargando promociones...</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Gestión de Promociones</h1>
      <div className="mb-6 flex gap-2">
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="Código" className="p-2 bg-base-300 rounded" />
        <input type="number" value={discount} onChange={e => setDiscount(parseInt(e.target.value || '0'))} className="p-2 bg-base-300 rounded w-32" />
        <Button onClick={handleCreate}>Crear</Button>
      </div>
      <ul className="space-y-2">
        {promos.map(p => (
          <li key={p.id} className="p-3 bg-base-200 rounded flex justify-between items-center">
            <div>
              {editingId === p.id ? (
                <div>
                  <input value={editCode} onChange={e => setEditCode(e.target.value)} className="p-2 bg-base-300 rounded mb-2" />
                  <input type="number" value={editDiscount} onChange={e => setEditDiscount(parseInt(e.target.value || '0'))} className="p-2 bg-base-300 rounded w-32" />
                </div>
              ) : (
                <>
                  <div className="font-semibold">{p.code}</div>
                  <div className="text-sm text-gray-400">{p.discount}%</div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {editingId === p.id ? (
                <>
                  <Button variant="primary" onClick={() => saveEdit(p.id)}>Guardar</Button>
                  <Button variant="ghost" onClick={cancelEdit}>Cancelar</Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => startEdit(p)}>Editar</Button>
                  <Button variant="danger" onClick={() => handleDelete(p.id)}>Eliminar</Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
