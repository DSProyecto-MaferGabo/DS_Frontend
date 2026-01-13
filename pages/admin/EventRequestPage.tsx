import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import eventsApi from '../../services/eventsApi';
import mediaApi from '../../services/mediaApi';
import type { Evento, Zona, EventFormat } from '../../types';
import { Button } from '../../components/ui/Button';
import { useKeycloak } from '../../hooks/useKeycloak';

const steps = ["Información del Evento", "Configurar Zonas", "Diseñar Asientos"];
const DEFAULT_POSTER_URL = 'https://picsum.photos/seed/newevent/800/1200';

const EventRequestPage = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();
  const { keycloakInstance } = useKeycloak();

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
  const [zones, setZones] = useState<(Partial<Zona> & { cantidad?: number })[]>([{ nombre: '', precio: 0, color: '#FF0000', cantidad: 10 }]);
  const [saving, setSaving] = useState(false);
  const [generalPrice, setGeneralPrice] = useState<number>(0);

  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, steps.length));

  useEffect(() => {
    setCategoriesLoading(true);
    eventsApi.getCategories()
      .then(setCategories)
      .catch((err) => {
        console.warn('Could not load categories:', err);
        setCategories([]);
      })
      .finally(() => setCategoriesLoading(false));
    setStagesLoading(true);
    eventsApi.getStages()
      .then(s => setStages(s || []))
      .catch(err => { console.warn('Could not load stages:', err); setStages([]); })
      .finally(() => setStagesLoading(false));
  }, []);

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
      if (fileId) {
        await eventsApi.updateEvent(eventId, { posterUrl: `https://minio.localhost/${storageObjectKey || `event-posters/${fileId}`}` });
      }
    } catch (err) {
      console.warn('Could not upload poster', err);
    }
  };

  const handleSubmit = async () => {
    if (!eventInfo.nombre || !eventInfo.descripcion || !eventInfo.fecha || !selectedStageId) {
      alert('Completa todos los campos requeridos');
      return;
    }

    // Check authentication
    if (!keycloakInstance?.authenticated) {
      alert('No estás autenticado. Inicia sesión nuevamente.');
      navigate('/login');
      return;
    }

    setSaving(true);
    try {
      // Build payload depending on event format
      let requestPayload: any = {
        name: eventInfo.nombre,
        description: eventInfo.descripcion,
        date: eventInfo.fecha,
        time: eventInfo.hora ? eventInfo.hora : null,
        stageId: Number(selectedStageId),
        categoryId: eventInfo.categoryId || null,
        eventFormat: eventInfo.eventFormat || 'presencial',
        streamingUrl: eventInfo.streamingUrl || null
      };
      if (eventInfo.eventFormat === 'streaming') {
        requestPayload.zones = [];
        requestPayload.generalPrice = generalPrice;
      } else {
        requestPayload.zones = zones.map(z => ({
          name: z.nombre,
          price: z.precio,
          seatCount: z.cantidad || 10,
          color: z.color || '#FF0000'
        }));
      }

      await eventsApi.createEventRequest(requestPayload);
      alert('Solicitud de evento enviada exitosamente. Será revisada por un administrador.');
      navigate('/admin/organizador');
    } catch (err: any) {
      console.error('Error creating event request:', err);
      alert('Error al enviar la solicitud. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  // Only show step 1 for streaming events
  const isStreaming = eventInfo.eventFormat === 'streaming';
  const renderStep = () => {
    if (categoriesLoading || stagesLoading) {
      return <div className="text-center py-8">Cargando datos...</div>;
    }
    if (isStreaming) {
      return <EventInfoStep data={eventInfo} setData={setEventInfo} posterPreview={posterPreview} onPosterSelected={handlePosterSelected} onProgramSelected={handleProgramSelected} onReceiptSelected={handleReceiptSelected} categories={categories} categoriesLoading={categoriesLoading} stages={stages} stagesLoading={stagesLoading} selectedStageId={selectedStageId} setSelectedStageId={setSelectedStageId} generalPrice={generalPrice} setGeneralPrice={setGeneralPrice} />;
    }
    switch (currentStep) {
      case 1:
        return <EventInfoStep data={eventInfo} setData={setEventInfo} posterPreview={posterPreview} onPosterSelected={handlePosterSelected} onProgramSelected={handleProgramSelected} onReceiptSelected={handleReceiptSelected} categories={categories} categoriesLoading={categoriesLoading} stages={stages} stagesLoading={stagesLoading} selectedStageId={selectedStageId} setSelectedStageId={setSelectedStageId} />;
      case 2:
        return <ZoneConfigStep data={zones} setData={setZones} />;
      case 3:
        return <SeatDesignStep zones={zones} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      {!isStreaming && (
        <div className="flex items-center mb-8">
          {steps.map((step, index) => (
            <React.Fragment key={index}>
              <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold ${
                currentStep > index + 1 ? 'bg-green-500 text-white' :
                currentStep === index + 1 ? 'bg-primary text-white' :
                'bg-base-300 text-gray-400'
              }`}>
                {index + 1}
              </div>
              <span className={`ml-2 mr-4 ${currentStep === index + 1 ? 'text-primary font-semibold' : 'text-gray-400'}`}>
                {step}
              </span>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-px ${currentStep > index + 1 ? 'bg-green-500' : 'bg-base-300'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
      {renderStep()}
      <div className="flex gap-2 mt-8">
        {!isStreaming && (
          <Button
            onClick={handleBack}
            disabled={currentStep === 1}
            variant="ghost"
          >
            Anterior
          </Button>
        )}
        {isStreaming ? (
          <Button onClick={handleSubmit} variant="primary" disabled={saving}>
            {saving ? 'Enviando solicitud...' : 'Enviar Solicitud'}
          </Button>
        ) : currentStep < steps.length ? (
          <Button onClick={handleNext} variant="primary">
            Siguiente
          </Button>
        ) : (
          <Button onClick={handleSubmit} variant="primary" disabled={saving}>
            {saving ? 'Enviando solicitud...' : 'Enviar Solicitud'}
          </Button>
        )}
      </div>
    </div>
  );
};

const EventInfoStep = ({
  data,
  setData,
  posterPreview,
  onPosterSelected,
  onProgramSelected,
  onReceiptSelected,
  categories,
  categoriesLoading,
  stages,
  stagesLoading,
  selectedStageId,
  setSelectedStageId,
  generalPrice,
  setGeneralPrice
}: {
  data: Partial<Evento>;
  setData: React.Dispatch<React.SetStateAction<Partial<Evento>>>;
  posterPreview: string;
  onPosterSelected: (file: File | null) => void;
  onProgramSelected: (file: File | null) => void;
  onReceiptSelected: (file: File | null) => void;
  categories: { id: number; name: string }[];
  categoriesLoading: boolean;
  stages: any[];
  stagesLoading: boolean;
  selectedStageId: number | '';
  setSelectedStageId: React.Dispatch<React.SetStateAction<number | ''>>;
  generalPrice?: number;
  setGeneralPrice?: (price: number) => void;
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (file: File | null) => void) => {
    const file = e.target.files?.[0] || null;
    setter(file);
  };

  return (
    <form className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block mb-2 font-semibold">Nombre del Evento *</label>
          <input
            type="text"
            value={data.nombre || ''}
            onChange={e => setData(prev => ({ ...prev, nombre: e.target.value }))}
            className="w-full p-3 bg-base-200 rounded-lg"
            placeholder="Ej: Concierto de Rock"
            required
          />
        </div>
        <div>
          <label className="block mb-2 font-semibold">Fecha *</label>
          <input
            type="date"
            value={data.fecha || ''}
            onChange={e => setData(prev => ({ ...prev, fecha: e.target.value }))}
            className="w-full p-3 bg-base-200 rounded-lg"
            required
          />
        </div>
      </div>

      <div>
        <label className="block mb-2 font-semibold">Descripción *</label>
        <textarea
          value={data.descripcion || ''}
          onChange={e => setData(prev => ({ ...prev, descripcion: e.target.value }))}
          className="w-full p-3 bg-base-200 rounded-lg h-32"
          placeholder="Describe tu evento..."
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block mb-2 font-semibold">Escenario *</label>
          {stagesLoading ? (
            <div className="text-sm text-gray-500">Cargando escenarios...</div>
          ) : stages && stages.length > 0 ? (
            <select
              className="w-full p-3 bg-base-200 rounded-lg"
              value={selectedStageId}
              onChange={e => setSelectedStageId(e.target.value ? Number(e.target.value) : '')}
              required
            >
              <option value="">-- Selecciona escenario --</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}{s.location ? ` · ${s.location}` : ''}</option>)}
            </select>
          ) : (
            <div className="text-sm text-gray-500">No hay escenarios disponibles.</div>
          )}
        </div>
        <div>
          <label className="block mb-2 font-semibold">Categoría</label>
          {categoriesLoading ? (
            <div className="text-sm text-gray-500">Cargando categorías...</div>
          ) : categories && categories.length > 0 ? (
            <select
              className="w-full p-3 bg-base-200 rounded-lg"
              value={(data as any).categoryId ?? ''}
              onChange={e => setData(prev => ({ ...prev, categoryId: e.target.value ? Number(e.target.value) : null }))
              }
            >
              <option value="">-- Sin categoría --</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <div className="text-sm text-gray-500">No hay categorías disponibles.</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block mb-2 font-semibold">Formato del Evento</label>
          <select
            className="w-full p-3 bg-base-200 rounded-lg"
            value={data.eventFormat || 'presencial'}
            onChange={e => setData(prev => ({ ...prev, eventFormat: e.target.value as EventFormat }))
            }
          >
            <option value="presencial">Presencial</option>
            <option value="streaming">Streaming</option>
            <option value="hibrido">Híbrido</option>
          </select>

        {/* General price for streaming events */}
        {data.eventFormat === 'streaming' && (
          <div>
            <label className="block mb-2 font-semibold">Precio General de Entrada *</label>
            <input
              type="number"
              value={generalPrice}
              min={0}
              step={0.01}
              onChange={e => setGeneralPrice && setGeneralPrice(parseFloat(e.target.value))}
              className="w-full p-3 bg-base-200 rounded-lg"
              placeholder="Ej: 100.00"
              required
            />
          </div>
        )}
        </div>
        {(data.eventFormat === 'streaming' || data.eventFormat === 'hibrido') && (
          <div>
            <label className="block mb-2 font-semibold">Enlace de Streaming</label>
            <input
              type="url"
              value={data.streamingUrl || ''}
              onChange={e => setData(prev => ({ ...prev, streamingUrl: e.target.value }))}
              className="w-full p-3 bg-base-200 rounded-lg"
              placeholder="https://youtube.com/live/..."
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block mb-2 font-semibold">Póster del Evento</label>
          <input
            type="file"
            accept="image/*"
            onChange={e => handleFileChange(e, onPosterSelected)}
            className="w-full p-2 bg-base-200 rounded-lg file:btn file:btn-sm file:btn-primary"
          />
        </div>
        <div>
          <label className="block mb-2 font-semibold">Programa (PDF)</label>
          <input
            type="file"
            accept=".pdf"
            onChange={e => handleFileChange(e, onProgramSelected)}
            className="w-full p-2 bg-base-200 rounded-lg file:btn file:btn-sm file:btn-primary"
          />
        </div>
        <div>
          <label className="block mb-2 font-semibold">Comprobante de Pago</label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={e => handleFileChange(e, onReceiptSelected)}
            className="w-full p-2 bg-base-200 rounded-lg file:btn file:btn-sm file:btn-primary"
          />
        </div>
      </div>

      {posterPreview && (
        <div className="mt-4">
          <label className="block mb-2 font-semibold">Vista previa del póster:</label>
          <img src={posterPreview} alt="Poster preview" className="max-w-xs rounded-lg shadow-lg" />
        </div>
      )}
    </form>
  );
};

const ZoneConfigStep = ({
  data,
  setData
}: {
  data: (Partial<Zona> & { cantidad?: number })[];
  setData: React.Dispatch<React.SetStateAction<(Partial<Zona> & { cantidad?: number })[]>>;
}) => {
  const updateZone = (index: number, changes: Partial<Zona> & { cantidad?: number }) => {
    setData(prev => prev.map((z, i) => i === index ? { ...z, ...changes } : z));
  };

  const addZone = () => {
    setData(prev => [...prev, { nombre: '', precio: 0, color: '#FF0000', cantidad: 10 }]);
  };

  const removeZone = (index: number) => {
    setData(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Configurar Zonas</h3>
      {data.map((zone, idx) => (
        <div key={idx} className="p-4 bg-base-200 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block mb-1 text-sm">Nombre</label>
              <input
                className="w-full p-2 bg-white rounded"
                value={zone.nombre || ''}
                onChange={e => updateZone(idx, { nombre: e.target.value })}
                placeholder="Ej: VIP"
              />
            </div>
            <div>
              <label className="block mb-1 text-sm">Precio</label>
              <input
                type="number"
                className="w-full p-2 bg-white rounded"
                value={zone.precio ?? 0}
                min={0}
                step={0.01}
                onChange={e => updateZone(idx, { precio: parseFloat(e.target.value || '0') })}
              />
            </div>
            <div>
              <label className="block mb-1 text-sm">Cantidad</label>
              <input
                type="number"
                className="w-full p-2 bg-white rounded"
                value={zone.cantidad ?? 10}
                min={0}
                onChange={e => updateZone(idx, { cantidad: parseInt(e.target.value || '0') })}
              />
            </div>
            <div>
              <label className="block mb-1 text-sm">Color</label>
              <input
                type="color"
                className="w-full h-10 p-1 bg-white rounded"
                value={zone.color || '#FF0000'}
                onChange={e => updateZone(idx, { color: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-3">
            <button type="button" className="btn btn-sm btn-error" onClick={() => removeZone(idx)}>Eliminar zona</button>
          </div>
        </div>
      ))}

      <div>
        <button type="button" className="btn btn-primary" onClick={addZone}>Agregar zona</button>
      </div>
    </div>
  );
};

const SeatDesignStep = ({ zones }: { zones: (Partial<Zona> & { cantidad?: number })[] }) => {
  return (
    <div>
      <h3 className="font-semibold text-lg mb-4">Diseñar Asientos</h3>
      {zones && zones.length > 0 ? (
        <div className="space-y-2">
          {zones.map((z, i) => (
            <div key={i} className="p-3 bg-base-200 rounded">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{z.nombre || `Zona ${i + 1}`}</div>
                  <div className="text-sm text-gray-500">Precio: {z.precio ?? 0} · Cantidad: {z.cantidad ?? 0}</div>
                </div>
                <div style={{ width: 32, height: 32, backgroundColor: z.color || '#FF0000' }} className="rounded" />
              </div>
              <div className="mt-2 text-sm text-gray-600">Aquí puedes integrar un diseñador de asientos o un preview.</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500">No hay zonas configuradas.</div>
      )}
    </div>
  );
};

export default EventRequestPage;

