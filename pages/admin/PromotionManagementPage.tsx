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
        <Button onClick={handleCreate} variant="primary">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Crear
        </Button>
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
                  <Button variant="primary" size="sm" onClick={() => saveEdit(p.id)} aria-label="Guardar promoción">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelEdit} aria-label="Cancelar edición">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(p)} aria-label="Editar promoción">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 13.5V19h5.5L19.5 8.999l-5.5-5.5L4 13.5z" />
                    </svg>
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(p.id)} aria-label="Eliminar promoción">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6" />
                    </svg>
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
