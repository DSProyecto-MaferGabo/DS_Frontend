import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import eventsApi from '../../services/eventsApi';
import reservationsApi from '../../services/reservationsApi';
import { Button } from '../../components/ui/Button';
import type { Evento } from '../../types';

export const EventEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [evento, setEvento] = useState<Partial<Evento> | null>(null);
  const [loading, setLoading] = useState(true);
  const [zonas, setZonas] = useState<any[]>([]);
  const [seats, setSeats] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [stageId, setStageId] = useState<number | null>(null);
  const [stageInfo, setStageInfo] = useState<any | null>(null);
  const [hoveredSeatId, setHoveredSeatId] = useState<string | number | null>(null);

  // Pending/local-only changes (not saved until "Guardar Cambios")
  const [pendingAddedSeats, setPendingAddedSeats] = useState<any[]>([]);
  const [pendingDeletedSeatIds, setPendingDeletedSeatIds] = useState<any[]>([]); // rawId or tempId
  const [pendingPromotions, setPendingPromotions] = useState<any[]>([]);

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
          try {
            const si = await eventsApi.getStage(sId);
            setStageInfo(si);
            // If the event doesn't have an explicit ubicacion, use the stage location
            setEvento(prev => ({ ...(prev || {}), ubicacion: si.location ?? si.Location ?? (prev as any)?.ubicacion ?? '' }));
          } catch (e) {
            console.warn('Could not load stage info', e);
          }
        }

        if (sId) {
          const result = await eventsApi.getSeats(sId);
          let loadedSeats = result.seats || [];
          // annotate original name and price for change detection
          setZonas((result.zonas || []).map((z: any) => ({ ...z, _originalName: z.nombre, _originalPrecio: z.precio ?? z.price ?? 0 })));

          // Fetch reservations for this event and mark occupied seats
          try {
            const allRes = await reservationsApi.getReservations();
            const eventRes = (allRes || []).filter((r: any) => Number(r.eventoId) === Number(id) || Number(r.eventoId) === Number((data as any).id));
            // For each reservation, mark seats as occupied (CONFIRMADA / paid)
            eventRes.forEach((r: any) => {
              const isPaid = r.estado === 'CONFIRMADA' || (r as any).paid;
              (r.seats || []).forEach((seatItem: any) => {
                const asientoId = String(seatItem.asientoId ?? seatItem.asiento ?? seatItem.id ?? seatItem.asientoRawId ?? '');
                // find matching seat in loadedSeats by rawId or constructed id
                const match = loadedSeats.find((s: any) => String(s.rawId ?? s.id) === asientoId || String(s.id) === asientoId || String(s.rawId) === asientoId || `${s.escenarioId}-${s.fila}-${s.numero}` === asientoId);
                if (match) {
                  const m: any = match;
                  m.estado = 'ocupado';
                  m.ocupado = true;
                  m.sold = true;
                  m._buyer = { name: r.usuario?.nombre, email: r.usuario?.email };
                }
              });
            });
          } catch (e) {
            console.warn('Could not fetch reservations to mark occupied seats', e);
          }

          setSeats(loadedSeats);
        }

        // load categories for category select
        try {
          const cats = await eventsApi.getCategories();
          setCategories(cats || []);
          // ensure event includes categoryId from fetched DTO
          setEvento(prev => ({ ...(prev || {}), categoryId: (data as any).categoryId ?? (prev as any)?.categoryId ?? null }));
        } catch (e) {
          console.warn('Could not load categories', e);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  // helper: compute if event is past (date + optional time)
  const eventDateTime = (evt?: any) => {
    if (!evt || !evt.fecha) return new Date(0);
    const date = String(evt.fecha);
    const parts = date.split('-').map(Number);
    if (parts.length < 3) return new Date(date);
    const [y, m, d] = parts;
    let hour = 23, minute = 59, second = 59;
    const time = evt.hora ?? evt.time ?? null;
    if (time) {
      const tparts = String(time).split(':').map((p:any) => Number(p));
      if (!isNaN(tparts[0])) hour = tparts[0];
      if (!isNaN(tparts[1])) minute = tparts[1];
      if (!isNaN(tparts[2])) second = tparts[2];
    }
    return new Date(y, m-1, d, hour, minute, second);
  };

  const isPastEvent = evento ? (eventDateTime(evento) < new Date()) : false;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEvento(prev => ({ ...(prev || {}), [name]: value }));
  };

  // Add seat locally (do not call API yet)
  const addSeatLocally = (zone: any) => {
    // compute next row/seat based on current seats + pendingAddedSeats
    const seatsForZone = [...seats, ...pendingAddedSeats].filter(s => (s.zonaId || s.zone) === zone.id || s.zone === zone.nombre || s.zonaId === zone.id);
    const seatsPerRow = 10;
    const rows = seatsForZone.map(s => parseInt(String(s.fila || '').replace(/[^0-9]/g,''))).filter(n => !isNaN(n));
    const maxRow = rows.length ? Math.max(...rows) : 1;
    const seatsInMaxRow = seatsForZone.filter(s => (s.fila || 'R1') === `R${maxRow}`);
    let rowNumber = `R${maxRow}`;
    let seatNumber = seatsInMaxRow.length + 1;
    if (seatNumber > seatsPerRow) { rowNumber = `R${maxRow+1}`; seatNumber = 1; }
    const tempId = `temp-${Date.now()}-${Math.floor(Math.random()*10000)}`;
    const newSeat = {
      id: tempId,
      rawId: tempId,
      fila: rowNumber,
      numero: seatNumber,
      zonaId: zone.id,
      zone: zone.nombre,
      escenarioId: stageId,
      precio: zone.precio ?? 0,
      _new: true,
    };
    setPendingAddedSeats(prev => [...prev, newSeat]);
    setSeats(prev => [...prev, newSeat]);
  };

  // Mark deletion locally
  const deleteSeatLocally = (seat: any) => {
    // if seat is newly created locally, remove from pendingAddedSeats
    if (seat._new) {
      setPendingAddedSeats(prev => prev.filter(s => s.rawId !== seat.rawId));
      setSeats(prev => prev.filter(s => s.rawId !== seat.rawId));
      return;
    }
    setPendingDeletedSeatIds(prev => [...prev, seat.rawId]);
    setSeats(prev => prev.filter(s => s.rawId !== seat.rawId));
  };

  const handleSave = async () => {
    if (!id || !evento) return;
    try {
      // update core event fields
      await eventsApi.updateEvent(Number(id), {
        name: evento.nombre || 'Evento',
        description: evento.descripcion || '',
        date: (evento.fecha || new Date().toISOString().slice(0,10)),
        stageId: stageId ?? 1,
        categoryId: (evento as any).categoryId ?? null,
      });

      // Apply zona name changes (existing behaviour) - only update seats for existing seats
      if (zonas && zonas.length > 0) {
        const updatePromises: Promise<any>[] = [];
        for (const z of zonas) {
          const nameChanged = !!z._originalName && z._originalName !== z.nombre;
          const priceChanged = (z._originalPrecio ?? 0) !== (z.precio ?? z.price ?? 0);
          if (!nameChanged && !priceChanged) continue;
          const affected = seats.filter(s => s.zonaId === z.id && !s._new && !pendingDeletedSeatIds.includes(s.rawId));
          for (const s of affected) {
            if (!s.rawId) continue;
            // include both zone name and price in payload so price-only changes are persisted
            updatePromises.push(eventsApi.updateSeat(s.rawId, { row_number: s.fila, seatnumber: parseInt(String(s.numero || '1')), zone: z.nombre, StageId: s.escenarioId, price: z.precio ?? z.price }));
          }
        }
        if (updatePromises.length > 0) await Promise.all(updatePromises);
      }

      // Create pending new seats
      if (pendingAddedSeats.length > 0) {
        for (const s of pendingAddedSeats) {
          try {
            await eventsApi.createSeat({ row_number: s.fila, seatnumber: s.numero, zone: s.zone, StageId: s.escenarioId, price: s.precio });
          } catch (e) { console.error('Error creating seat', e); }
        }
      }

      // Delete pending deletions
      if (pendingDeletedSeatIds.length > 0) {
        for (const rid of pendingDeletedSeatIds) {
          try { await eventsApi.deleteSeat(rid); } catch (e) { console.error('Error deleting seat', e); }
        }
      }

      // Create promotions buffered locally
      if (pendingPromotions.length > 0) {
        for (const p of pendingPromotions) {
          try {
            await eventsApi.createPromotion({ code: p.code, description: p.description, percentage: p.percentage, startDate: p.startDate, endDate: p.endDate, eventId: Number(id) });
          } catch (e) { console.error('Error creating promotion', e); }
        }
      }

      alert('Cambios guardados correctamente');
      // refresh everything
      const refreshed = await eventsApi.getEvent(Number(id));
      setEvento(refreshed);
      if (stageId) {
        const r = await eventsApi.getSeats(stageId);
        setSeats(r.seats || []);
        setZonas(r.zonas || []);
        setPendingAddedSeats([]);
        setPendingDeletedSeatIds([]);
        setPendingPromotions([]);
        try { const si = await eventsApi.getStage(stageId); setStageInfo(si); } catch {/*ignore*/}
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

  const eventStatus = () => {
    const isCancelled = (evento as any).isCancelled;
    const isPublished = (evento as any).isPublished;
    if (isCancelled === true) return { label: 'Cancelado', bg: 'bg-red-600', text: 'text-white' };
    if (isPublished === true) return { label: 'Publicado', bg: 'bg-green-600', text: 'text-white' };
    return { label: 'Creado', bg: 'bg-gray-500', text: 'text-white' };
  };

  const status = eventStatus();
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Editar Evento</h1>
        <div>
          <span className={`px-3 py-1 rounded ${status.bg} ${status.text} font-semibold`}>{status.label}</span>
        </div>
      </div>
      {isPastEvent && (
        <div className="mb-4 p-3 rounded bg-yellow-200 text-yellow-900">Este evento ya ocurrió. No se permiten ediciones, eliminaciones ni agregar elementos.</div>
      )}
      <div className="bg-base-200 p-6 rounded-lg mb-6">
        {stageInfo && (
          <div className="mb-4 p-3 bg-base-300 rounded">
            <div className="font-semibold">Escenario: {stageInfo.Name ?? stageInfo.name}</div>
            <div className="text-sm text-gray-400">Ubicación: {stageInfo.location} · Aforo: {stageInfo.peoplecapacity ?? stageInfo.peopleCapacity}</div>
          </div>
        )}
    <label className="block mb-2 font-semibold">Nombre</label>
      <input name="nombre" value={evento.nombre || ''} onChange={handleChange} className="w-full p-2 bg-base-300 rounded mb-4" disabled={isPastEvent} />

  <label className="block mb-2 font-semibold">Fecha</label>
        <input name="fecha" type="date" value={evento.fecha ? evento.fecha.substring(0,10) : ''} onChange={handleChange} className="w-full p-2 bg-base-300 rounded mb-4" disabled={isPastEvent} />

  <label className="block mb-2 font-semibold">Ubicación</label>
        <input name="ubicacion" value={evento.ubicacion || ''} onChange={handleChange} className="w-full p-2 bg-base-300 rounded mb-4" disabled={isPastEvent} />

  <label className="block mb-2 font-semibold">Descripción</label>
    <textarea name="descripcion" value={evento.descripcion || ''} onChange={handleChange} className="w-full p-2 bg-base-300 rounded mb-4" rows={4} disabled={isPastEvent} />

  <label className="block mb-2 font-semibold">Categoría</label>
    <select className="w-full p-2 bg-base-300 rounded mb-4" value={(evento as any).categoryId ?? ''} onChange={e => setEvento(prev => ({ ...(prev || {}), categoryId: e.target.value ? Number(e.target.value) : null }))} disabled={isPastEvent}>
      <option value="">-- Sin categoría --</option>
      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>

        <div className="flex gap-2">
          <Button onClick={handleSave} variant="primary" disabled={isPastEvent}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Guardar Cambios
          </Button>
          <Button onClick={handlePublish} variant="secondary" disabled={isPastEvent}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
            </svg>
            Publicar
          </Button>
          <Button onClick={handleCancel} variant="ghost" disabled={isPastEvent}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancelar
          </Button>
          <Button onClick={handleDelete} variant="danger" disabled={isPastEvent}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6" />
            </svg>
            Eliminar
          </Button>
        </div>
      </div>

      <div className="bg-base-200 p-6 rounded-lg">
  <h2 className="text-2xl font-bold mb-4">Zonas y Precios</h2>
        {zonas.length === 0 ? (
          <p className="text-gray-400">No se encontraron zonas para este escenario.</p>
        ) : (
          <div className="space-y-6">
            {zonas.map(z => (
              <div key={z.id} className="p-4 bg-base-300 rounded">
                <div className="flex justify-between items-center mb-3">
                  <div>
                      <div>
                        <label className="block mb-2 font-semibold">Nombre de zona</label>
                        <input className="font-semibold p-1 bg-base-100 rounded mb-1" value={z.nombre} onChange={e => setZonas(prev => prev.map(x => x.id === z.id ? { ...x, nombre: e.target.value } : x))} />
                      </div>
                      <div>
                        <label className="block mb-2 font-semibold">Precio por asiento</label>
                        <input type="number" className="w-28 p-1 bg-base-100 rounded" value={z.precio ?? 0} onChange={e => setZonas(prev => prev.map(x => x.id === z.id ? { ...x, precio: parseFloat(e.target.value || '0') } : x))} />
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => { if (isPastEvent) { alert('No se pueden agregar asientos a un evento ya sucedido.'); return; } addSeatLocally(z); }} disabled={isPastEvent}>Agregar asiento</Button>
                    <Button variant="ghost" onClick={() => { navigator.clipboard?.writeText(JSON.stringify({ zona: z.nombre, precio: z.precio })); alert('Zona copiada al portapapeles'); }}>Copiar zona</Button>
                  </div>
                </div>

                <div className="inline-block bg-black p-3 rounded">
                          {(() => {
                            const seatsForZone = seats.filter(s => (s.zonaId === z.id) || s.zone === z.nombre || (s.zonaId == null && s.zone == z.nombre));
                            const rowsMap: Record<string, any[]> = {};
                            seatsForZone.forEach((s: any) => { rowsMap[s.fila] = rowsMap[s.fila] || []; rowsMap[s.fila].push(s); });
                            const rows = Object.keys(rowsMap).sort((a,b)=> { const an = parseInt(a.replace(/[^0-9]/g,''))||0; const bn = parseInt(b.replace(/[^0-9]/g,''))||0; return an-bn; });
                            return rows.map(rn => (
                              <div key={rn} className="flex gap-2 mb-2">
                                {rowsMap[rn].sort((a: any,b: any)=> parseInt(String(a.numero||'0'))-parseInt(String(b.numero||'0'))).map((s:any)=> {
                                  const seatId = s.rawId ?? s.id;
                                  const isHovered = hoveredSeatId === seatId;
                                  const isOccupied = s.estado === 'ocupado' || s.ocupado || s.sold;
                                  const baseColor = isOccupied ? 'bg-gray-700' : s._new ? 'bg-blue-500' : 'bg-green-600';
                                  const hoverColor = isHovered && !isOccupied ? 'bg-red-600 text-white' : '';
                                  const cursor = isOccupied ? 'cursor-not-allowed' : 'cursor-pointer';
                                  return (
                                    <div
                                      key={seatId}
                                      className={`relative w-8 h-8 rounded flex items-center justify-center text-xs ${hoverColor || baseColor} ${cursor}`}
                                      title={isOccupied ? 'Asiento ocupado' : (s._new ? 'Nuevo (no guardado)' : s.estado)}
                                      onMouseEnter={() => setHoveredSeatId(seatId)}
                                      onMouseLeave={() => setHoveredSeatId(null)}
                                      onClick={() => {
                                        if (isPastEvent) { alert('No se pueden modificar asientos de un evento ya sucedido.'); return; }
                                        if (isOccupied) { alert('Este asiento ya fue comprado y no puede eliminarse.'); return; }
                                        const name = `${s.fila}-${s.numero}`;
                                        const details = `Asiento ${name}\nZona: ${s.zone || s.zonaId}\nPrecio: ${s.precio ?? s.price ?? 'N/A'}`;
                                        if (confirm(`¿Eliminar \n${details}\n\nConfirma eliminación de este asiento?`)) {
                                          deleteSeatLocally(s);
                                        }
                                      }}
                                    >
                                      {isHovered && !isOccupied ? (
                                        <span className="font-bold">✕</span>
                                      ) : (
                                        <span>{s.numero}</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ));
                          })()}
                </div>

                {/* Legend and interaction notes */}
                <div className="mt-3 text-sm">
                  <div className="mb-2 font-semibold">Leyenda de colores</div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2"><span className="w-4 h-4 bg-green-600 rounded" /> Disponible</div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 bg-blue-500 rounded" /> Nuevo (no guardado)</div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 bg-red-600 rounded" /> Hover para eliminar</div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 bg-gray-700 rounded" /> Comprado / No editable</div>
                  </div>
                  <div className="mt-2 text-gray-500">Pasa el mouse por encima de un asiento para marcarlo en rojo y eliminarlo. Los asientos comprados no pueden eliminarse.</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <hr className="my-4" />
        <h2 className="text-2xl font-bold mb-4">Promociones</h2>
        <PromotionsSectionLocal eventId={Number(id)} pendingPromotions={pendingPromotions} setPendingPromotions={setPendingPromotions} />
      </div>
    </div>
  );
};

const PromotionsSectionLocal = ({ eventId, pendingPromotions, setPendingPromotions }: { eventId: number, pendingPromotions: any[], setPendingPromotions: React.Dispatch<React.SetStateAction<any[]>> }) => {
  const [list, setList] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [desc, setDesc] = useState('');
  const [pct, setPct] = useState(10);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => { load(); }, []);
  const load = async () => { try { const p = await eventsApi.getPromotions(); setList((p||[]).filter((x:any)=> x.EventId===eventId || x.eventId===eventId || x.eventId==String(eventId))); } catch (e) { console.error(e); } };
  const createLocal = async () => {
    const item = { code, description: desc, percentage: pct, startDate, endDate };
    setPendingPromotions(prev => [...prev, item]);
    setCode(''); setDesc(''); setPct(10); setStartDate(''); setEndDate('');
    // keep existing list from server separated; show pending below
  };
  return (
    <div>
      <div className="grid grid-cols-4 gap-2 mb-4">
            <div>
              <label className="block mb-2 font-semibold">Código</label>
              <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Código" className="p-2 bg-base-100 rounded" />
            </div>
            <div>
              <label className="block mb-2 font-semibold">Descripción</label>
              <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Descripción" className="p-2 bg-base-100 rounded" />
            </div>
            <div>
              <label className="block mb-2 font-semibold">Porcentaje</label>
              <input type="number" value={pct} onChange={e=>setPct(Number(e.target.value))} className="p-2 bg-base-100 rounded" />
            </div>
            <div>
              <label className="block mb-2 font-semibold">Inicio</label>
              <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="p-2 bg-base-100 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div>
              <label className="block mb-2 font-semibold">Fin</label>
              <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="p-2 bg-base-100 rounded" />
            </div>
            <div />
            <div className="flex items-end">
              <Button onClick={createLocal} variant="primary">Crear Promo (local)</Button>
            </div>
          </div>

      <div>
        <div className="mb-2">Promociones en servidor:</div>
        {list.length===0 ? <p className="text-gray-400">No hay promociones.</p> : (
          <ul className="list-disc pl-5">
            {list.map((p:any,i:number)=> <li key={i}>{p.Code ?? p.code} — {p.Description ?? p.description} — {p.Percentage ?? p.percentage}%</li>)}
          </ul>
        )}

        <div className="mt-4">Promociones nuevas (no guardadas):</div>
        {pendingPromotions.length===0 ? <p className="text-gray-400">No hay promociones pendientes.</p> : (
          <ul className="list-disc pl-5">
            {pendingPromotions.map((p:any,i:number)=> <li key={i}>{p.code} — {p.description} — {p.percentage}%</li>)}
          </ul>
        )}
      </div>
    </div>
  );
};
