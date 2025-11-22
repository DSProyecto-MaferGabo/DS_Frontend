import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import eventsApi from '../../services/eventsApi';
// FIX: Import Escenario type
import type { Evento, Zona, Asiento, Escenario } from '../../types';
import { Button } from '../../components/ui/Button';

const steps = ["Información del Evento", "Configurar Zonas", "Diseñar Asientos"];

export const EventCreationPage = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();
  
  const [eventInfo, setEventInfo] = useState<Partial<Evento>>({
    nombre: '',
    descripcion: '',
    fecha: '',
    ubicacion: '',
    posterUrl: 'https://picsum.photos/seed/newevent/800/1200'
  });
  const [zones, setZones] = useState<Partial<Zona>[]>([{ nombre: '', precio: 0, color: '#FF0000' }]);
  const [seats, setSeats] = useState<Partial<Asiento>[]>([]);

  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, steps.length));
  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleSaveEvent = async () => {
    try {
        // This is a simplified simulation for json-server
        // 1. Create Escenario (Stage) first so we can reference its id from Event and Seats
        const newEscenario = await eventsApi.createStage({ name: eventInfo.ubicacion || 'Escenario Principal', peoplecapacity: 100, location: eventInfo.ubicacion || 'Ubicación' });

        // 2. Save Event referencing the created stage
        const newEventResp = await eventsApi.createEvent({
          name: eventInfo.nombre || 'Nuevo Evento',
          description: eventInfo.descripcion || '',
          date: (eventInfo.fecha || new Date().toISOString().slice(0,10)),
          stageId: newEscenario.id,
        });

        // 3. Save Seats -> map to backend AddSeatDto { row_number, seatnumber, zone, StageId }
        await Promise.all(seats.map(seat => {
            const zoneName = (seat.zonaId as any) || (zones[0]?.nombre) || 'General';
            const row = seat.fila || 'R1';
            const number = parseInt((seat.numero as any) || '1');
            return eventsApi.createSeat({ row_number: row, seatnumber: number, zone: zoneName, StageId: newEscenario.id });
        }));

        alert('¡Evento creado con éxito!');
        navigate('/admin/eventos');
    } catch (error) {
        console.error("Error creating event:", error);
        alert('Hubo un error al crear el evento.');
    }
  };

  const renderStep = () => {
    switch(currentStep) {
      case 1: return <EventInfoStep data={eventInfo} setData={setEventInfo} />;
      case 2: return <ZoneConfigStep data={zones} setData={setZones} />;
      case 3: return <SeatDesignStep zones={zones} seats={seats} setSeats={setSeats} />;
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

      <div className="flex justify-between mt-8">
        <Button onClick={handleBack} disabled={currentStep === 1} variant="ghost">Atrás</Button>
        {currentStep < steps.length ? (
          <Button onClick={handleNext}>Siguiente</Button>
        ) : (
          <Button onClick={handleSaveEvent} variant="primary">Guardar Evento</Button>
        )}
      </div>
    </div>
  );
};

const EventInfoStep = ({ data, setData }: { data: Partial<Evento>, setData: React.Dispatch<React.SetStateAction<Partial<Evento>>>}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  return (
    <form className="space-y-4">
      <input type="text" name="nombre" value={data.nombre} onChange={handleChange} placeholder="Nombre del Evento" className="w-full p-3 bg-base-300 rounded"/>
      <input type="datetime-local" name="fecha" value={data.fecha ? new Date(data.fecha).toISOString().substring(0, 16) : ''} onChange={handleChange} className="w-full p-3 bg-base-300 rounded"/>
      <input type="text" name="ubicacion" value={data.ubicacion} onChange={handleChange} placeholder="Ubicación / Escenario" className="w-full p-3 bg-base-300 rounded"/>
      <textarea name="descripcion" value={data.descripcion} onChange={handleChange} placeholder="Descripción" className="w-full p-3 bg-base-300 rounded" rows={5}></textarea>
    </form>
  );
};

const ZoneConfigStep = ({ data, setData }: { data: Partial<Zona>[], setData: React.Dispatch<React.SetStateAction<Partial<Zona>[]>>}) => {
    const handleChange = (index: number, field: keyof Zona, value: string | number) => {
        const newData = [...data];
        (newData[index] as any)[field] = value;
        setData(newData);
    };
    const addZone = () => setData([...data, { nombre: '', precio: 0, color: '#0000FF' }]);
    return (
        <div>
            {data.map((zone, index) => (
                <div key={index} className="flex items-center gap-4 mb-4 p-4 bg-base-300 rounded">
                    <input type="color" value={zone.color} onChange={e => handleChange(index, 'color', e.target.value)} className="h-12 w-12 rounded"/>
                    <input type="text" value={zone.nombre} onChange={e => handleChange(index, 'nombre', e.target.value)} placeholder="Nombre de la Zona (ej. VIP)" className="flex-grow p-2 bg-base-100 rounded" />
                    <input type="number" value={zone.precio} onChange={e => handleChange(index, 'precio', parseFloat(e.target.value))} placeholder="Precio" className="w-32 p-2 bg-base-100 rounded" />
                </div>
            ))}
            <Button onClick={addZone} variant="secondary">Añadir Zona</Button>
        </div>
    );
};

const SeatDesignStep = ({ zones, seats, setSeats }: { zones: Partial<Zona>[], seats: Partial<Asiento>[], setSeats: React.Dispatch<React.SetStateAction<Partial<Asiento>[]>> }) => {
    const [selectedZone, setSelectedZone] = useState(zones[0]?.nombre || '');
    // Simple grid for simulation
    const grid = Array.from({ length: 5 }, (_, r) => Array.from({ length: 10 }, (_, c) => ({ row: r + 1, col: c + 1 })));

    const toggleSeat = (row: number, col: number) => {
        const seatId = `R${row}C${col}`;
        const existing = seats.find(s => s.fila === `R${row}` && s.numero === `${col}`);
        if(existing) {
            setSeats(seats.filter(s => !(s.fila === `R${row}` && s.numero === `${col}`)));
        } else {
            setSeats([...seats, { fila: `R${row}`, numero: `${col}`, estado: 'disponible', zonaId: selectedZone as any }]);
        }
    };
    
    return (
        <div>
            <div className="flex items-center gap-4 mb-6">
                <label>Seleccionar Zona para "Dibujar":</label>
                <select value={selectedZone} onChange={e => setSelectedZone(e.target.value)} className="p-2 bg-base-300 rounded">
                    {zones.map((z, i) => <option key={i} value={z.nombre}>{z.nombre}</option>)}
                </select>
            </div>
            <div className="bg-black p-4 inline-block">
                {grid.map((row, rIndex) => (
                    <div key={rIndex} className="flex gap-2 mb-2">
                        {row.map(({row, col}) => {
                            const seat = seats.find(s => s.fila === `R${row}` && s.numero === `${col}`);
                            // FIX: Cast seat.zonaId to 'any' because it temporarily holds a string name, not a number ID.
                            const zone = zones.find(z => z.nombre === (seat?.zonaId as any));
                            return <button 
                                key={col} 
                                onClick={() => toggleSeat(row, col)}
                                className="w-8 h-8 rounded" 
                                style={{ backgroundColor: seat ? zone?.color : '#4B5563' }}
                            />
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};