import React, { useEffect, useMemo, useState } from 'react';
import eventsApi from '../../services/eventsApi';
import reservationsApi from '../../services/reservationsApi';
import { Button } from '../../components/ui/Button';
import { Link } from 'react-router-dom';

const PromotionManagementPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<any | null>(null);
  const [code, setCode] = useState('');
  const [percentage, setPercentage] = useState<number>(10);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [evts, promos, res] = await Promise.all([
        eventsApi.getMyEvents(),
        eventsApi.getPromotions(),
        reservationsApi.getReservations(),
      ]);
      setEvents(evts || []);
      
      // Filter promotions to only those for the organizer's events
      const eventIds = new Set((evts || []).map((e: any) => e.id));
      const filteredPromos = (promos || []).filter((p: any) => {
        const eventId = Number(p.eventId ?? p.EventId ?? p.event ?? p.eventoId ?? 0);
        return eventIds.has(eventId);
      });
      setPromotions(filteredPromos);
      
      setReservations(res || []);
    } catch (err) {
      console.error('Error loading promotions management data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const promoCountsByEvent = useMemo(() => {
    const map: Record<number, { total: number; active: number }> = {};
    const now = new Date();
    (promotions || []).forEach((p: any) => {
      const eid = Number(p.eventId ?? p.EventId ?? p.event ?? p.eventoId ?? 0);
      if (!map[eid]) map[eid] = { total: 0, active: 0 };
      map[eid].total += 1;
      const start = p.startDate ? new Date(p.startDate) : p.StartDate ? new Date(p.StartDate) : null;
      const end = p.endDate ? new Date(p.endDate) : p.EndDate ? new Date(p.EndDate) : null;
      const isActive = (!start || start <= now) && (!end || end >= now);
      if (isActive) map[eid].active += 1;
    });
    return map;
  }, [promotions]);

  const promotionsForEvent = (evId: number) => {
    return (promotions || []).filter((p: any) => Number(p.eventId ?? p.EventId ?? p.event ?? p.eventoId ?? 0) === Number(evId));
  };

  const usageCount = (promoCode: string, evId: number) => {
    return (reservations || []).filter((r: any) => {
      const sameEvent = Number(r.eventoId ?? r.eventId ?? r.event) === Number(evId);
      return sameEvent && String(r.couponCode ?? r.CouponCode ?? '').toLowerCase() === String(promoCode ?? '').toLowerCase();
    }).length;
  };

  const handleCreate = async () => {
    if (!selectedEvent) return setErrorMsg('Seleccione primero un evento');
    setErrorMsg(null); setMessage(null);
    const trimmedCode = (code || '').trim();
    if (!trimmedCode) return setErrorMsg('El código no puede estar vacío');
    const duplicate = (promotions || []).some((p: any) => (p.code ?? p.Code ?? '').toString().trim().toLowerCase() === trimmedCode.toLowerCase());
    if (duplicate) return setErrorMsg('Ya existe una promoción con ese código');
    try {
      const payload: any = {
        Code: code,
        Description: '',
        Percentage: percentage,
        StartDate: startDate || null,
        EndDate: endDate || null,
        EventId: selectedEvent.id ?? selectedEvent.id,
      };
      await eventsApi.createPromotion(payload);
      setShowCreateModal(false);
      setCode(''); setPercentage(10); setStartDate(''); setEndDate('');
      setMessage('Promoción creada correctamente');
      fetchAll();
    } catch (err: any) {
      console.error('Could not create promotion', err);
      setErrorMsg(err?.message ?? String(err));
    }
  };

  const handleEditSave = async () => {
    if (!editingPromotion) return;
    setErrorMsg(null); setMessage(null);
    const trimmedCode = (code || '').trim();
    if (!trimmedCode) return setErrorMsg('El código no puede estar vacío');
    const pid = (editingPromotion.id ?? editingPromotion.Id);
    const duplicate = (promotions || []).some((p: any) => ((p.id ?? p.Id) !== pid) && ((p.code ?? p.Code ?? '').toString().trim().toLowerCase() === trimmedCode.toLowerCase()));
    if (duplicate) return setErrorMsg('Ya existe otra promoción con ese código');
    try {
      const payload: any = {
        Code: code,
        Description: '',
        Percentage: percentage,
        StartDate: startDate || null,
        EndDate: endDate || null,
        EventId: selectedEvent?.id ?? editingPromotion.eventId ?? editingPromotion.EventId,
      };
      await eventsApi.updatePromotion(pid, payload);
      setShowEditModal(false);
      setEditingPromotion(null);
      setCode(''); setPercentage(10); setStartDate(''); setEndDate('');
      setMessage('Promoción actualizada correctamente');
      fetchAll();
    } catch (err: any) {
      console.error('Could not update promotion', err);
      setErrorMsg(err?.message ?? String(err));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar promoción?')) return;
    const promo = (promotions || []).find(p => (p.id ?? p.Id) === id || (p.Id ?? p.id) === id || (Number(p.eventId ?? p.EventId) && true));
    console.log('[PromotionManagement] Deleting promotion id=', id, 'found object=', promo);
    try { await eventsApi.deletePromotion(id); fetchAll(); } catch (err) { console.error(err); }
  };

  if (loading) return <div className="p-6">Cargando Promociones...</div>;

  return (
    <div className="p-6">
      {message && <div className="mb-4 p-3 bg-green-800 text-white rounded">{message}</div>}
      {errorMsg && <div className="mb-4 p-3 bg-red-800 text-white rounded">{errorMsg}</div>}
      <h1 className="text-3xl font-bold mb-4">Promociones</h1>

      {!selectedEvent && (
        <div>
          <p className="mb-4 text-gray-300">Lista de eventos con conteo de promociones. Selecciona un evento para ver y gestionar sus promociones.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(events || []).map(ev => {
              const counts = promoCountsByEvent[Number(ev.id)] || { total: 0, active: 0 };
              return (
                <div key={ev.id} className="bg-base-200 p-4 rounded shadow">
                  <h3 className="text-lg font-semibold">{ev.nombre}</h3>
                  <p className="text-sm text-gray-400 mb-3">{ev.descripcion}</p>
                  <div className="flex gap-3 mb-3">
                    <div className="bg-base-300 px-3 py-1 rounded">Total: <strong>{counts.total}</strong></div>
                    <div className="bg-base-300 px-3 py-1 rounded">Activas: <strong>{counts.active}</strong></div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={() => setSelectedEvent(ev)}>Ver promociones</Button>
                    <Link to={`/admin/eventos/${ev.id}/editar`} className="ml-auto">
                      <Button variant="ghost">Editar evento</Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedEvent && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">Promociones para: {selectedEvent.nombre}</h2>
              <div className="text-sm text-gray-400">{selectedEvent.descripcion}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSelectedEvent(null)}>Volver</Button>
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>Agregar nueva promoción</Button>
            </div>
          </div>

          <div className="space-y-3">
            {promotionsForEvent(selectedEvent.id).length === 0 && (
              <div className="p-4 bg-base-300 rounded">No hay promociones para este evento.</div>
            )}
            {promotionsForEvent(selectedEvent.id).map((p:any) => {
              const pid = p.id ?? p.Id;
              const start = p.startDate ? new Date(p.startDate) : p.StartDate ? new Date(p.StartDate) : null;
              const end = p.endDate ? new Date(p.endDate) : p.EndDate ? new Date(p.EndDate) : null;
              const now = new Date();
              const isActive = (!start || start <= now) && (!end || end >= now);
              return (
                <div key={pid} className="p-3 bg-base-200 rounded flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{p.code ?? p.Code}</div>
                    <div className="text-sm text-gray-400">Descuento: {p.percentage ?? p.Percentage ?? p.discount ?? p.Discount}%</div>
                    <div className="text-xs text-gray-500">Inicio: {start ? start.toLocaleString() : '—'} · Fin: {end ? end.toLocaleString() : '—'}</div>
                    <div className="text-xs text-gray-500">Estado: {isActive ? <span className="text-success">Activo</span> : <span className="text-warning">Caducada</span>}</div>
                    <div className="text-xs text-gray-500">Aplicaciones: <strong>{usageCount(p.code ?? p.Code, selectedEvent.id)}</strong></div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingPromotion({ ...p, id: pid }); setCode(p.code ?? p.Code ?? ''); setPercentage(p.percentage ?? p.Percentage ?? p.discount ?? p.Discount ?? 10); setStartDate((p.startDate ?? p.StartDate ?? '')?.toString().split('T')?.[0] ?? ''); setEndDate((p.endDate ?? p.EndDate ?? '')?.toString().split('T')?.[0] ?? ''); setShowEditModal(true); }}>
                      Editar
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(pid)}>Eliminar</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCreateModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-base-200 p-6 rounded w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">Crear promoción para {selectedEvent.nombre}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Código</label>
                <input className="w-full p-2 bg-base-300 rounded" value={code} onChange={e => setCode(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Descuento %</label>
                <input type="number" className="w-32 p-2 bg-base-300 rounded" value={percentage} onChange={e => setPercentage(parseInt(e.target.value || '0'))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Fecha inicio</label>
                  <input type="date" className="w-full p-2 bg-base-300 rounded" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Fecha fin</label>
                  <input type="date" className="w-full p-2 bg-base-300 rounded" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
              <Button variant="primary" onClick={handleCreate}>Crear promoción</Button>
            </div>
          </div>
        </div>
      )}

        {showEditModal && editingPromotion && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-base-200 p-6 rounded w-full max-w-lg">
              <h3 className="text-xl font-bold mb-4">Editar promoción: {editingPromotion.code ?? editingPromotion.Code}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Código</label>
                  <input className="w-full p-2 bg-base-300 rounded" value={code} onChange={e => setCode(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Descuento %</label>
                  <input type="number" className="w-32 p-2 bg-base-300 rounded" value={percentage} onChange={e => setPercentage(parseInt(e.target.value || '0'))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Fecha inicio</label>
                    <input type="date" className="w-full p-2 bg-base-300 rounded" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Fecha fin</label>
                    <input type="date" className="w-full p-2 bg-base-300 rounded" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => { setShowEditModal(false); setEditingPromotion(null); }}>Cancelar</Button>
                <Button variant="primary" onClick={handleEditSave}>Guardar cambios</Button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default PromotionManagementPage;
 
