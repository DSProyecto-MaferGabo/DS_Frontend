import React, { useEffect, useState } from 'react';
import eventsApi from '../../services/eventsApi';
import { Button } from '../../components/ui/Button';
import { useKeycloak } from '../../hooks/useKeycloak';

export const StageManagementPage = () => {
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState<number>(100);
  const [location, setLocation] = useState('');
  const [editing, setEditing] = useState<any | null>(null);

  // selectedStageId is used to load and show a stage's calendar in a modal
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [eventsByDate, setEventsByDate] = useState<Record<string, any[]>>({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { profile } = useKeycloak();
  const isAdmin = (profile?.roles || []).includes('administrador');

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await eventsApi.getStages();
      setStages(data || []);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  useEffect(() => {
    if (selectedStageId) loadEventsForStage(selectedStageId);
    else setEventsByDate({});
  }, [selectedStageId]);

  const loadEventsForStage = async (stageId: number) => {
    try {
      const all = await eventsApi.getMyEvents();
      const stageEvents = (all || []).filter((e: any) => e.stageId === stageId);
      const map: Record<string, any[]> = {};
      stageEvents.forEach((ev: any) => {
        const d = (ev.fecha ?? ev.date ?? '').toString().slice(0,10);
        if (!d) return;
        map[d] = map[d] || [];
        map[d].push(ev);
      });
      setEventsByDate(map);
    } catch (e) { console.error('Error loading events for stage', e); }
  };

  const handleCreate = async () => {
    if (!isAdmin) return alert('Solo un administrador puede crear escenarios.');
    try {
      await eventsApi.createStage({ name, peoplecapacity: capacity, location });
      setName(''); setCapacity(100); setLocation('');
      fetch();
    } catch (err) { console.error(err); alert('Error al crear escenario'); }
  };

  const handleEditStart = (s: any) => { if (!isAdmin) return; setEditing(s); setName(s.Name ?? s.name ?? ''); setCapacity(s.peoplecapacity ?? 100); setLocation(s.location ?? ''); };
  const handleCancelEdit = () => { setEditing(null); setName(''); setCapacity(100); setLocation(''); };
  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!isAdmin) return alert('Solo un administrador puede editar escenarios.');
    try {
      await eventsApi.updateStage(editing.Id ?? editing.id, { Name: name, peoplecapacity: capacity, location });
      handleCancelEdit(); fetch();
    } catch (e) { console.error('Error updating', e); alert('Error al actualizar'); }
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) return alert('Solo un administrador puede eliminar escenarios.');
    if (!confirm('¿Eliminar escenario? Esta acción no elimina eventos.')) return;
    try { await eventsApi.deleteStage(id); fetch(); if (selectedStageId === id) setSelectedStageId(null); } catch (e) { console.error(e); alert('Error al eliminar'); }
  };

  // calendar helpers
  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const generateMonthGrid = () => {
    const start = startOfMonth.getDay();
    const daysInMonth = endOfMonth.getDate();
    const rows: number[][] = [];
    let week: number[] = [];
    for (let i = 0; i < start; i++) week.push(0);
    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d);
      if (week.length === 7) { rows.push(week); week = []; }
    }
    if (week.length > 0) { while (week.length < 7) week.push(0); rows.push(week); }
    return rows;
  };
  const changeMonth = (delta: number) => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  if (loading) return <p>Cargando escenarios...</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Gestión de Escenarios</h1>

      {/* Create / Edit area */}
      <div className="bg-base-200 p-4 rounded-lg mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Crear / Editar Escenario</h2>
          {isAdmin && !editing && (
            <Button onClick={() => setShowCreate(prev => !prev)} variant="primary" size="sm" aria-label="Mostrar crear escenario">
              {showCreate ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Ocultar
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Crear Escenario
                </>
              )}
            </Button>
          )}
        </div>

        {isAdmin && (editing || showCreate) ? (
          <>
            <label className="block text-sm">Nombre</label>
            <input className="w-full p-2 mb-2 bg-base-100 rounded" value={name} onChange={e => setName(e.target.value)} />
            <label className="block text-sm">Aforo</label>
            <input type="number" className="w-full p-2 mb-2 bg-base-100 rounded" value={capacity} onChange={e => setCapacity(Number(e.target.value))} />
            <label className="block text-sm">Ubicación</label>
            <input className="w-full p-2 mb-4 bg-base-100 rounded" value={location} onChange={e => setLocation(e.target.value)} />
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button onClick={handleSaveEdit} variant="primary" size="sm" aria-label="Actualizar">Guardar</Button>
                  <Button onClick={handleCancelEdit} variant="ghost" size="sm" aria-label="Cancelar">Cancelar</Button>
                </>
              ) : (
                <Button onClick={handleCreate} variant="primary" size="sm" aria-label="Crear">Crear</Button>
              )}
            </div>
          </>
        ) : (
          <div className="text-gray-500">Solo los administradores pueden crear o modificar escenarios.</div>
        )}
      </div>

      {/* Cards grid similar to HomePage */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Escenarios</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stages.map(s => (
            <div key={s.Id ?? s.id} className="bg-base-300 rounded-lg overflow-hidden shadow-lg">
              <div className="h-40 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(17,24,39,0.4), rgba(17,24,39,0.4)), url('https://picsum.photos/seed/stage-${s.Id ?? s.id}/800/400')` }} />
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-lg font-bold">{s.Name ?? s.name}</div>
                    <div className="text-sm text-gray-400">{s.location}</div>
                  </div>
                  <div className="text-sm text-gray-500">Aforo: {s.peoplecapacity ?? s.peopleCapacity ?? '—'}</div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button onClick={() => { setSelectedStageId(s.Id ?? s.id); setModalOpen(true); }} variant="secondary" size="sm" aria-label="Ver calendario">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </Button>
                  {isAdmin && (
                  <Button onClick={() => handleEditStart(s)} variant="ghost" size="sm" aria-label="Editar escenario">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 13.5V19h5.5L19.5 8.999l-5.5-5.5L4 13.5z" />
                    </svg>
                  </Button>
                  )}
                  {isAdmin && (
                  <Button onClick={() => handleDelete(s.Id ?? s.id)} variant="danger" size="sm" aria-label="Eliminar escenario">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6" />
                    </svg>
                  </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Calendar modal */}
      {modalOpen && selectedStageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setModalOpen(false); setSelectedStageId(null); setEventsByDate({}); }} />
          <div className="relative bg-base-200 rounded-lg w-[90%] max-w-4xl p-6 z-10 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Calendario — {stages.find(s=> (s.Id ?? s.id) === selectedStageId)?.Name ?? stages.find(s=> (s.Id ?? s.id) === selectedStageId)?.name ?? `Escenario ${selectedStageId}`}</h3>
                <div className="flex items-center gap-2">
                <Button onClick={() => changeMonth(-1)} variant="ghost" size="sm" aria-label="Mes anterior">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Button>
                <div className="px-3">{currentMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
                <Button onClick={() => changeMonth(1)} variant="ghost" size="sm" aria-label="Mes siguiente">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
                <Button onClick={() => { setModalOpen(false); setSelectedStageId(null); setEventsByDate({}); }} variant="ghost" size="sm" aria-label="Cerrar">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center mb-2">
              {['Dom','Lun','Mar','Mie','Jue','Vie','Sab'].map(d => <div key={d} className="font-semibold">{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {generateMonthGrid().map((week, wi) => (
                <React.Fragment key={wi}>
                  {week.map((day, di) => {
                    if (day === 0) return <div key={di} className="h-28 p-2 bg-base-100 rounded" />;
                    const dateKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const events = (eventsByDate[dateKey] || []);
                    const hasEvents = events.length > 0;
                    return (
                      <div key={di} className={`h-28 p-2 rounded ${hasEvents ? 'bg-green-600/20 border border-green-400' : 'bg-base-100'}`}>
                        <div className="font-semibold">{day}</div>
                        {hasEvents && (
                          <ul className="text-sm text-gray-700 mt-1">
                            {events.map((ev:any,i:number)=>(<li key={i}>{ev.nombre || ev.name}</li>))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
