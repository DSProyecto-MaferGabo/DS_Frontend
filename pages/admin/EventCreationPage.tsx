import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import eventsApi from '../../services/eventsApi';
import mediaApi, { MediaFileType } from '../../services/mediaApi';
// FIX: Import Escenario type
import type { Evento, Zona, Asiento, Escenario, EventFormat } from '../../types';
import { Button } from '../../components/ui/Button';

const steps = ["Información del Evento", "Configurar Zonas", "Diseñar Asientos"];
const DEFAULT_POSTER_URL = 'https://picsum.photos/seed/newevent/800/1200';

export const EventCreationPage = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();
  
  const [eventInfo, setEventInfo] = useState<Partial<Evento>>({
    nombre: '',
    descripcion: '',
    fecha: '',
    ubicacion: '',
    posterUrl: DEFAULT_POSTER_URL,
    eventFormat: 'presencial',
    streamingUrl: ''
  });
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string>(DEFAULT_POSTER_URL);
  const [programFile, setProgramFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<{ id:number; name:string }[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [stages, setStages] = useState<any[]>([]);
  const [stagesLoading, setStagesLoading] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<number | ''>('');
  const [zones, setZones] = useState<Partial<Zona>[]>([{ nombre: '', precio: 0, color: '#FF0000' }]);
  // seats are now auto-generated from zones when creating the event
  const [saving, setSaving] = useState(false);

  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, steps.length));
  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  useEffect(() => {
    // load categories for selection
    setCategoriesLoading(true);
    eventsApi.getCategories()
      .then(setCategories)
      .catch((err) => {
        console.warn('Could not load categories:', err);
        setCategories([]);
      })
      .finally(() => setCategoriesLoading(false));
    // load stages for selection
    setStagesLoading(true);
    eventsApi.getStages()
      .then(s => setStages(s || []))
      .catch(err => { console.warn('Could not load stages:', err); setStages([]); })
      .finally(() => setStagesLoading(false));
  }, []);

  // keep selectedZone in sync when zones list changes
  useEffect(() => {
    if (zones && zones.length > 0) {
      // noop if already set
    }
  }, [zones]);

  useEffect(() => {
    return () => {
      if (posterPreview && posterPreview.startsWith('blob:')) {
        URL.revokeObjectURL(posterPreview);
      }
    };
  }, [posterPreview]);

  const handlePosterSelected = (file: File | null) => {
    setPosterFile(file);
    if (file) {
      setPosterPreview(prev => {
        if (prev && prev.startsWith('blob:')) {
          URL.revokeObjectURL(prev);
        }
        return URL.createObjectURL(file);
      });
    } else {
      setPosterPreview(eventInfo.posterUrl ?? DEFAULT_POSTER_URL);
    }
  };

  const handleProgramSelected = (file: File | null) => {
    setProgramFile(file);
  };

  const handleReceiptSelected = (file: File | null) => {
    setReceiptFile(file);
  };

  const uploadPosterIfNeeded = async (eventId: number) => {
    if (!posterFile) return;
    try {
      const upload = await mediaApi.uploadEventPoster({ eventId, file: posterFile });
      const fileId = upload.id ?? upload.Id ?? null;
      let storageObjectKey = (upload as any)?.storageObjectKey ?? (upload as any)?.StorageObjectKey ?? null;
      let finalPosterUrl = upload.publicUrl ?? upload.url ?? null;
      if (!storageObjectKey && fileId) {
        try {
          const metadata = await mediaApi.getFileMetadata(fileId);
          storageObjectKey = metadata?.storageObjectKey ?? metadata?.StorageObjectKey ?? null;
          finalPosterUrl = finalPosterUrl ?? metadata?.publicUrl ?? null;
        } catch (metaErr) {
          console.warn('No se pudo obtener metadata del poster', metaErr);
        }
      }

      if (!finalPosterUrl) {
        finalPosterUrl = eventInfo.posterUrl ?? DEFAULT_POSTER_URL;
      }
      await eventsApi.updatePoster(eventId, {
        posterUrl: finalPosterUrl,
        posterStorageObjectKey: storageObjectKey ?? undefined,
      });
      setPosterFile(null);
      setPosterPreview(finalPosterUrl);
    } catch (error) {
      console.error('No se pudo subir el poster del evento', error);
      alert('El evento se creó, pero no pudimos subir el poster. Inténtalo desde la pantalla de edición.');
    }
  };

  const uploadSupplementalFile = async (eventId: number, file: File | null, fileType: MediaFileType, friendlyName: string) => {
    if (!file) return;
    try {
      await mediaApi.uploadEventFile({ eventId, file, fileType });
      if (fileType === 'program') {
        setProgramFile(null);
      }
      if (fileType === 'payment-receipt') {
        setReceiptFile(null);
      }
    } catch (error) {
      console.error(`No se pudo subir el ${friendlyName}`, error);
      alert(`El evento se creó, pero no pudimos subir el ${friendlyName}. Inténtalo nuevamente desde la pantalla de edición.`);
    }
  };

  const handleSaveEvent = async () => {
    setSaving(true);
    try {
      // determine or create Escenario (Stage) so we can reference its id from Event and Seats
      // If the admin selected an existing stage in the dropdown, use it. Otherwise create a new one from eventInfo.ubicacion
      let newEscenario: any = null;
      if (selectedStageId) {
        // find the stage object from loaded stages
        newEscenario = stages.find(s => (s.Id ?? s.id) === selectedStageId) ?? { id: selectedStageId, Id: selectedStageId };
      } else {
        // Use stage details from eventInfo if provided (stageName, stageLocation, stageCapacity)
        const stageName = (eventInfo as any).stageName ?? eventInfo.ubicacion ?? 'Escenario Principal';
        const stageLocation = (eventInfo as any).stageLocation ?? eventInfo.ubicacion ?? 'Ubicación';
        const stageCapacity = Number((eventInfo as any).stageCapacity ?? 100) || 100;
        newEscenario = await eventsApi.createStage({ name: stageName, peoplecapacity: stageCapacity, location: stageLocation });
        // refresh stages list to include the newly created one
        try { const s = await eventsApi.getStages(); setStages(s || []); } catch { /* ignore */ }
      }

      // prepare date in yyyy-MM-dd (DateOnly) to match backend AddEventsDto
      const rawDate = (eventInfo.fecha as string) || new Date().toISOString();
      const dateOnly = rawDate.length >= 10 ? rawDate.slice(0, 10) : new Date(rawDate).toISOString().slice(0, 10);

      const eventFormat = ((eventInfo as any).eventFormat as EventFormat) ?? 'presencial';
      const streamingUrl = ((eventInfo as any).streamingUrl ?? '').toString().trim();
      if ((eventFormat === 'streaming' || eventFormat === 'hibrido') && streamingUrl.length === 0) {
        alert('Proporciona el enlace del streaming para eventos streaming o híbridos.');
        setSaving(false);
        return;
      }

      // Determine escenario/StageId robustly (backend may return Id or id)
  const escenarioId = (newEscenario as any)?.id ?? (newEscenario as any)?.Id ?? (newEscenario as any)?.stageId ?? null;
      if (!escenarioId) throw new Error('No se pudo obtener el Id del escenario creado');

      // 2. Save Event referencing the created stage
      const newEventResp = await eventsApi.createEvent({
        name: eventInfo.nombre || 'Nuevo Evento',
        description: eventInfo.descripcion || '',
        date: dateOnly,
        time: (eventInfo as any).hora ?? null,
        stageId: escenarioId,
        categoryId: (eventInfo as any).categoryId ?? null,
        eventFormat,
        streamingUrl: streamingUrl || undefined
      });

      const createdEventId = Number((newEventResp as any)?.id ?? (newEventResp as any)?.Id ?? 0);
      if (createdEventId > 0) {
        await uploadPosterIfNeeded(createdEventId);
        await uploadSupplementalFile(createdEventId, programFile, 'program', 'programa (PDF)');
        await uploadSupplementalFile(createdEventId, receiptFile, 'payment-receipt', 'comprobante de pago');
      }

      // 3. Save Seats -> map to backend AddSeatDto { row_number, seatnumber, zone, StageId }
        // create stage seats from zones (auto-generate matrix for each zone)
        try {
          const seatsPerRow = 10;
          const seatPromises: Promise<any>[] = [];

          // Filter out zones without a name to avoid silently creating 'General' seats
          // Use sensible defaults for cantidad (10) when not provided in state
          const validZones = (zones || []).filter(z => {
            const hasName = z && (z.nombre || '').toString().trim().length > 0;
            const cantidadNum = Number((z as any).cantidad ?? 10);
            return hasName && cantidadNum > 0;
          });
          console.debug('Valid zones for seat creation:', validZones.map(z => ({ nombre: z.nombre, cantidad: z.cantidad ?? 10, precio: z.precio ?? 0 })));
          if (validZones.length === 0) {
            console.warn('No valid zones to create seats for. Skipping seat creation. Zones:', zones);
          }

          validZones.forEach(zone => {
            const count = Number(zone.cantidad ?? 10);
            for (let i = 0; i < count; i++) {
              const row = Math.floor(i / seatsPerRow);
              const col = i % seatsPerRow;
              const rowNumber = `R${row + 1}`;
              const seatNumber = col + 1;
              // ensure price is numeric and StageId is the created escenario id
              const safePrice = Number((zone as any).precio ?? 0) || 0;

              const payload = {
                row_number: rowNumber,
                seatnumber: seatNumber,
                zone: (zone.nombre ?? 'General').toString(),
                StageId: escenarioId,
                price: safePrice
              };

              // debug log so you can inspect Network payloads in DevTools console
              console.debug('Creating seat payload:', payload);

              seatPromises.push(eventsApi.createSeat(payload));
            }
          });

          if (seatPromises.length > 0) await Promise.all(seatPromises);
        } catch (e) {
          console.error('Error creating seats', e);
        }

      alert('¡Evento creado con éxito!');
      navigate('/admin/eventos');
    } catch (error) {
      console.error("Error creating event:", error);
      alert('Hubo un error al crear el evento.');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch(currentStep) {
  case 1: return <EventInfoStep data={eventInfo} setData={setEventInfo} categories={categories} categoriesLoading={categoriesLoading} stages={stages} stagesLoading={stagesLoading} selectedStageId={selectedStageId} setSelectedStageId={setSelectedStageId} />;
  case 2: return <ZoneConfigStep data={zones} setData={setZones} />;
  case 3: return <SeatDesignStep zones={zones} />;
      default: return null;
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Crear Nuevo Evento</h1>
      <p className="text-gray-400 mb-6">Paso {currentStep} de {steps.length}: {steps[currentStep - 1]}</p>
      
      <div className="bg-base-200 p-8 rounded-lg shadow-lg min-h-[500px]">
        {renderStep()}
      </div>
      <div className="grid gap-4 md:grid-cols-2 items-start">
        <div>
          <label className="block mb-1">Poster del evento</label>
          <div className="flex flex-col md:flex-row gap-4 items-start">
            <img src={posterPreview} alt="Vista previa del poster" className="w-full md:w-48 rounded-lg object-cover border border-base-300" />
            <div className="space-y-2 w-full">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={e => handlePosterSelected((e.target.files && e.target.files[0]) ? e.target.files[0] : null)}
                className="w-full text-sm text-gray-200 file:bg-primary file:text-white file:border-0 file:px-4 file:py-2 file:rounded file:mr-3 file:cursor-pointer"
              />
              <p className="text-xs text-gray-400">Recomendado 1200x800px. Formatos: JPG, PNG o WebP (máx. 10MB).</p>
              <button type="button" className="text-xs text-primary underline" onClick={() => handlePosterSelected(null)}>Restablecer poster</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <div className="bg-base-200 rounded-lg p-4 border border-base-300">
          <h3 className="text-lg font-semibold mb-2">Programa en PDF</h3>
          <p className="text-sm text-gray-400 mb-3">Comparte el programa oficial del evento (únicamente PDF).</p>
          <input
            type="file"
            accept="application/pdf"
            onChange={e => handleProgramSelected((e.target.files && e.target.files[0]) ? e.target.files[0] : null)}
            className="w-full text-sm text-gray-200 file:bg-primary file:text-white file:border-0 file:px-4 file:py-2 file:rounded file:mr-3 file:cursor-pointer"
          />
          <p className="text-xs text-gray-400 mt-2">{programFile ? programFile.name : 'Ningún archivo seleccionado.'}</p>
          {programFile && (
            <button type="button" className="text-xs text-primary underline mt-1" onClick={() => handleProgramSelected(null)}>Quitar archivo</button>
          )}
        </div>

        <div className="bg-base-200 rounded-lg p-4 border border-base-300">
          <h3 className="text-lg font-semibold mb-2">Comprobante de pago</h3>
          <p className="text-sm text-gray-400 mb-3">Carga plantillas o formatos para validar pagos (PDF o imagen).</p>
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={e => handleReceiptSelected((e.target.files && e.target.files[0]) ? e.target.files[0] : null)}
            className="w-full text-sm text-gray-200 file:bg-primary file:text-white file:border-0 file:px-4 file:py-2 file:rounded file:mr-3 file:cursor-pointer"
          />
          <p className="text-xs text-gray-400 mt-2">{receiptFile ? receiptFile.name : 'Ningún archivo seleccionado.'}</p>
          {receiptFile && (
            <button type="button" className="text-xs text-primary underline mt-1" onClick={() => handleReceiptSelected(null)}>Quitar archivo</button>
          )}
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <Button onClick={handleBack} disabled={currentStep === 1} variant="ghost">Atrás</Button>
        {currentStep < steps.length ? (
          <Button onClick={handleNext}>Siguiente</Button>
        ) : (
          <Button onClick={handleSaveEvent} variant="primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar Evento'}</Button>
        )}
      </div>
    </div>
  );
};

const EventInfoStep = ({ data, setData, categories, categoriesLoading, stages, stagesLoading, selectedStageId, setSelectedStageId }: { data: Partial<Evento>, setData: React.Dispatch<React.SetStateAction<Partial<Evento>>>; categories?: { id:number; name:string }[]; categoriesLoading?: boolean; stages?: any[]; stagesLoading?: boolean; selectedStageId?: number | ''; setSelectedStageId?: React.Dispatch<React.SetStateAction<number | ''>> }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const currentFormat = (data as any).eventFormat ?? 'presencial';
  return (
    <form className="space-y-4">
      <input type="text" name="nombre" value={data.nombre} onChange={handleChange} placeholder="Nombre del Evento" className="w-full p-3 bg-base-300 rounded"/>
      <div className="flex gap-2">
        <input type="date" name="fecha" value={data.fecha ?? ''} onChange={handleChange} className="w-full p-3 bg-base-300 rounded"/>
        <input type="time" name="hora" value={(data as any).hora ?? ''} onChange={handleChange} className="w-40 p-3 bg-base-300 rounded" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="block mb-1 text-gray-400">Formato del evento</span>
          <select
            className="w-full p-2 bg-base-300 rounded"
            value={currentFormat}
            onChange={(e) => setData(prev => ({ ...prev, eventFormat: e.target.value as EventFormat }))}
          >
            <option value="presencial">Presencial</option>
            <option value="streaming">Streaming</option>
            <option value="hibrido">Híbrido</option>
          </select>
        </label>
        {currentFormat !== 'presencial' && (
          <label className="text-sm">
            <span className="block mb-1 text-gray-400">Enlace del streaming</span>
            <input
              type="url"
              name="streamingUrl"
              value={(data as any).streamingUrl ?? ''}
              onChange={handleChange}
              placeholder="https://youtube.com/live/..."
              className="w-full p-2 bg-base-300 rounded"
              required
            />
            <span className="text-xs text-gray-500">Usaremos este enlace para incrustar la transmisión.</span>
          </label>
        )}
      </div>
      <div>
        <label className="block mb-1">Escenario</label>
        {stagesLoading ? (
          <div className="text-sm text-gray-500">Cargando escenarios...</div>
          ) : stages && stages.length > 0 ? (
            <select className="w-full p-2 bg-base-300 rounded mb-2" value={selectedStageId ?? ''} onChange={e => setSelectedStageId && setSelectedStageId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">-- Crear nuevo escenario --</option>
              {stages.map(s => <option key={s.Id ?? s.id} value={s.Id ?? s.id}>{s.Name ?? s.name} — {s.location ?? ''}</option>)}
            </select>
        ) : (
          <div className="text-sm text-gray-500">No hay escenarios disponibles.</div>
        )}

        {/* If admin chose to create a new stage, allow entering its name/location here */}
        {(!selectedStageId) && (
          <div className="space-y-2">
            <input type="text" name="stageName" value={(data as any).stageName ?? ''} onChange={e => setData(prev => ({ ...prev, stageName: e.target.value }))} placeholder="Nombre del nuevo Escenario" className="w-full p-3 bg-base-300 rounded" />
            <input type="text" name="stageLocation" value={(data as any).stageLocation ?? ''} onChange={e => setData(prev => ({ ...prev, stageLocation: e.target.value }))} placeholder="Ubicación del nuevo Escenario" className="w-full p-3 bg-base-300 rounded" />
            <input type="number" name="stageCapacity" value={(data as any).stageCapacity ?? 100} onChange={e => setData(prev => ({ ...prev, stageCapacity: Number(e.target.value) }))} placeholder="Aforo" className="w-40 p-3 bg-base-300 rounded" />
          </div>
        )}
      </div>
      <textarea name="descripcion" value={data.descripcion} onChange={handleChange} placeholder="Descripción" className="w-full p-3 bg-base-300 rounded" rows={5}></textarea>
      {categoriesLoading ? (
        <div className="text-sm text-gray-500">Cargando categorías...</div>
      ) : categories && categories.length > 0 ? (
        <div className="mt-2">
          <label className="block mb-1">Categoría</label>
          <select className="w-full p-2 bg-base-300 rounded" value={(data as any).categoryId ?? ''} onChange={e => setData(prev => ({ ...prev, categoryId: e.target.value ? Number(e.target.value) : null }))}>
            <option value="">-- Sin categoría --</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      ) : (
        <div className="text-sm text-gray-500">No hay categorías disponibles.</div>
      )}
    </form>
  );
};

const ZoneConfigStep = ({ data, setData }: { data: Partial<Zona>[], setData: React.Dispatch<React.SetStateAction<Partial<Zona>[]>>}) => {
  const handleChange = (index: number, field: string, value: string | number) => {
    const newData = [...data];
    (newData[index] as any)[field] = value;
    setData(newData);
  };
  const addZone = () => setData([...data, { nombre: '', precio: 0, color: '#0000FF', cantidad: 10 } as any]);
  // Helper to render preview matrix for a zone
  const renderZonePreview = (zone: any) => {
    const count = Number(zone?.cantidad) || 10;
    const seatsPerRow = 10;
    const rows = Math.ceil(count / seatsPerRow);
    const items: Array<{ row: number; col: number; idx: number }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < seatsPerRow; c++) {
        const idx = r * seatsPerRow + c;
        if (idx >= count) break;
        items.push({ row: r + 1, col: c + 1, idx });
      }
    }
    return (
      <div className="mb-4">
        <div className="text-sm mb-2">Vista previa ({zone?.nombre || 'Zona'}):</div>
        <div className="inline-block bg-black p-3 rounded">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex gap-2 mb-2">
              {Array.from({ length: seatsPerRow }).map((__, c) => {
                const idx = r * seatsPerRow + c;
                if (idx >= count) return <div key={c} className="w-8 h-8" />;
                return (
                  <div key={c} className="w-8 h-8 rounded flex items-center justify-center text-xs text-white" style={{ backgroundColor: zone?.color || '#4B5563' }}>
                    {idx + 1}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {data.map((zone, index) => (
        <div key={index} className="mb-6 p-4 bg-base-300 rounded">
          <div className="flex items-center gap-4 mb-4">
            <input type="color" value={zone.color} onChange={e => handleChange(index, 'color', e.target.value)} className="h-12 w-12 rounded"/>
            <div className="flex-grow">
              <input type="text" value={zone.nombre} onChange={e => handleChange(index, 'nombre', e.target.value)} placeholder="Nombre de la Zona (ej. VIP)" className="w-full p-2 bg-base-100 rounded mb-2" />
              <div className="text-xs text-gray-400">Nombre: etiqueta visible para administradores y compradores.</div>
            </div>
            <div className="w-40">
              <input type="number" value={(zone as any).cantidad ?? 10} onChange={e => handleChange(index, 'cantidad', parseInt(e.target.value || '0'))} placeholder="Cantidad" className="w-full p-2 bg-base-100 rounded" />
              <div className="text-xs text-gray-400">Cantidad de asientos en esta zona.</div>
            </div>
            <div className="w-32">
              <input type="number" value={zone.precio} onChange={e => handleChange(index, 'precio', parseFloat(e.target.value || '0'))} placeholder="Precio" className="w-full p-2 bg-base-100 rounded" />
              <div className="text-xs text-gray-400">Precio por asiento en esta zona.</div>
            </div>
          </div>

          {/* Preview */}
          {renderZonePreview(zone)}
        </div>
      ))}
      <div className="mt-2">
        <Button onClick={addZone} variant="secondary">Añadir Zona</Button>
      </div>
    </div>
  );
};

const SeatDesignStep = ({ zones }: { zones: Partial<Zona>[] }) => {
  // Automatic generation: render all zones stacked, each as matrix with 10 seats/row
  const seatsPerRow = 10;
  return (
    <div className="space-y-6">
      {zones.map((zone, zi) => {
        const count = Number((zone as any).cantidad) || 10;
        const rows = Math.ceil(count / seatsPerRow);
        return (
          <div key={zi}>
            <h3 className="font-semibold mb-2">{zone.nombre || `Zona ${zi+1}`}</h3>
            <div className="inline-block bg-black p-3 rounded">
              {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex gap-2 mb-2">
                  {Array.from({ length: seatsPerRow }).map((__, c) => {
                    const idx = r * seatsPerRow + c;
                    if (idx >= count) return <div key={c} className="w-8 h-8" />;
                    return (
                      <div key={c} className="w-8 h-8 rounded flex items-center justify-center text-xs text-white" style={{ backgroundColor: zone?.color || '#4B5563' }}>
                        {idx + 1}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};