import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
// FIX: Import the Escenario type.
import type { Evento, Asiento, Zona, Escenario } from '../../types';
import { Button } from '../../components/ui/Button';

export const SeatSelectionPage = () => {
  const { id: eventoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [asientos, setAsientos] = useState<Asiento[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Asiento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!eventoId) return;
      setLoading(true);
      try {
        const [eventoData, escenariosData] = await Promise.all([
          api.get<Evento>(`/eventos/${eventoId}`),
          // FIX: Add generic type to api.get to correctly type escenariosData.
          api.get<Escenario[]>(`/escenarios?eventoId=${eventoId}`),
        ]);
        setEvento(eventoData);
        if (escenariosData.length > 0) {
          const escenarioId = escenariosData[0].id;
          const [asientosData, zonasData] = await Promise.all([
            api.get<Asiento[]>(`/asientos?escenarioId=${escenarioId}`),
            api.get<Zona[]>(`/zonas?escenarioId=${escenarioId}`),
          ]);
          setAsientos(asientosData);
          setZonas(zonasData);
        }
      } catch (error) {
        console.error("Error fetching seat data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventoId]);

  const zonasMap = useMemo(() => 
    zonas.reduce((acc, zona) => {
      acc[zona.id] = zona;
      return acc;
    }, {} as Record<number, Zona>),
  [zonas]);

  const toggleSeatSelection = (seat: Asiento) => {
    if (seat.estado === 'ocupado') return;
    setSelectedSeats(prev => 
      prev.find(s => s.id === seat.id)
        ? prev.filter(s => s.id !== seat.id)
        : [...prev, seat]
    );
  };

  const total = selectedSeats.reduce((acc, seat) => acc + (zonasMap[seat.zonaId]?.precio || 0), 0);

  const handleCheckout = () => {
    navigate('/checkout', { state: { selectedSeats, evento, zonasMap } });
  };
  
  if (loading) return <div className="text-center p-10">Cargando mapa de asientos...</div>;
  if (!evento) return <div className="text-center p-10">Evento no encontrado.</div>;
  
  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
      {/* Seat Map */}
      <div className="flex-grow p-4 overflow-auto">
        <h2 className="text-2xl font-bold text-center mb-4">Selecciona tus Asientos</h2>
        <div className="bg-base-300/50 w-full p-4 text-center text-white font-bold rounded-t-lg">ESCENARIO</div>
        <div className="p-8 bg-base-200 rounded-b-lg flex flex-col items-center gap-4">
          {asientos.filter(a => a.zonaId === 1).map(seat => (
            <Seat key={seat.id} seat={seat} zona={zonasMap[seat.zonaId]} onSelect={toggleSeatSelection} isSelected={!!selectedSeats.find(s => s.id === seat.id)} />
          ))}
          <div className="flex gap-4 mt-8">
          {asientos.filter(a => a.zonaId === 2).map(seat => (
            <Seat key={seat.id} seat={seat} zona={zonasMap[seat.zonaId]} onSelect={toggleSeatSelection} isSelected={!!selectedSeats.find(s => s.id === seat.id)} />
          ))}
          </div>
          <div className="flex gap-2 mt-8 flex-wrap justify-center">
          {asientos.filter(a => a.zonaId === 3).map(seat => (
            <Seat key={seat.id} seat={seat} zona={zonasMap[seat.zonaId]} onSelect={toggleSeatSelection} isSelected={!!selectedSeats.find(s => s.id === seat.id)} />
          ))}
          </div>
        </div>
      </div>

      {/* Summary Sidebar */}
      <aside className="w-full lg:w-96 bg-base-200 p-6 flex flex-col shadow-lg">
        <h2 className="text-2xl font-bold mb-4">{evento.nombre}</h2>
        <div className="flex-grow overflow-y-auto">
          <h3 className="text-lg font-semibold text-primary mb-2">Asientos Seleccionados</h3>
          {selectedSeats.length === 0 ? (
            <p className="text-gray-400">No has seleccionado ningún asiento.</p>
          ) : (
            <ul className="space-y-2">
              {selectedSeats.map(seat => (
                <li key={seat.id} className="flex justify-between items-center bg-base-300 p-2 rounded">
                  <div>
                    <span className="font-semibold">{seat.fila} - {seat.numero}</span>
                    <span className="text-sm text-gray-400 ml-2">({zonasMap[seat.zonaId]?.nombre})</span>
                  </div>
                  <span className="font-bold">${zonasMap[seat.zonaId]?.precio.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-auto pt-4 border-t border-gray-700">
          <div className="flex justify-between items-center text-2xl font-bold mb-4">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <Button onClick={handleCheckout} disabled={selectedSeats.length === 0} className="w-full" size="lg">
            Proceder al Pago
          </Button>
        </div>
      </aside>
    </div>
  );
};

// FIX: Define Seat as a React.FC with explicit props to handle the 'key' prop correctly.
interface SeatProps {
  seat: Asiento;
  zona: Zona;
  onSelect: (seat: Asiento) => void;
  isSelected: boolean;
}

const Seat: React.FC<SeatProps> = ({ seat, zona, onSelect, isSelected }) => {
  const stateClasses = {
    disponible: 'cursor-pointer hover:opacity-80',
    ocupado: 'bg-gray-600 cursor-not-allowed opacity-50',
    seleccionado: 'ring-4 ring-white shadow-lg'
  };

  const currentStatus = isSelected ? 'seleccionado' : seat.estado;

  return (
    <button
      onClick={() => onSelect(seat)}
      disabled={seat.estado === 'ocupado'}
      className={`w-10 h-10 rounded text-xs font-bold text-white flex items-center justify-center transition-all ${stateClasses[currentStatus]}`}
      style={{ backgroundColor: seat.estado !== 'ocupado' ? zona.color : undefined }}
      title={`${seat.fila} - ${seat.numero}\n${zona.nombre} - $${zona.precio.toFixed(2)}`}
    >
      {seat.numero}
    </button>
  );
};