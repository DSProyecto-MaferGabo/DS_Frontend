import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import eventsApi from '../../services/eventsApi';
import reservationsApi from '../../services/reservationsApi';
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
  const [holdExpires, setHoldExpires] = useState<string | null>(null);
  const [holdToken, setHoldToken] = useState<string | null>(null);
  const [holdRemaining, setHoldRemaining] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!eventoId) return;
      setLoading(true);
      try {
        const eventDto = await eventsApi.getEvent(Number(eventoId));
        setEvento(eventDto);
        const stageId = eventDto.stageId;
        if (stageId) {
          const { seats: mappedSeats, zonas: mappedZonas } = await eventsApi.getSeats(stageId);
          setAsientos(mappedSeats);
          setZonas(mappedZonas);
          try { console.debug('SeatSelection: fetched seats', { stageId, seats: mappedSeats, zonas: mappedZonas }); } catch {}
        } else {
          // fallback: get all seats
          const { seats: mappedSeats, zonas: mappedZonas } = await eventsApi.getSeats();
          setAsientos(mappedSeats);
          setZonas(mappedZonas);
          try { console.debug('SeatSelection: fetched seats (all stages)', { seats: mappedSeats, zonas: mappedZonas }); } catch {}
        }
  // fetch reservations for this event and mark seats occupied
        try {
          const allRes = await reservationsApi.getReservations();
          const forEvent = (allRes || []).filter((r: any) => Number(r.eventoId) === Number(eventoId));
          const reservedSeatIds = new Set<string>();
          forEvent.forEach((r: any) => {
            if (r.seats && Array.isArray(r.seats)) {
              r.seats.forEach((s: any) => {
                if (s.asientoId) reservedSeatIds.add(s.asientoId);
              });
            }
          });
          if (reservedSeatIds.size > 0) {
            setAsientos(prev => prev.map(a => ({ ...a, estado: reservedSeatIds.has(a.id) ? 'ocupado' : a.estado })));
          }
        } catch (e) {
          // ignore reservation fetch errors
        }

        // hydrate existing hold from sessionStorage (if any)
        try {
          const token = sessionStorage.getItem(`hold_token_${eventoId}`);
          const expires = sessionStorage.getItem(`hold_expires_${eventoId}`);
          if (token && expires) {
            setHoldToken(token);
            setHoldExpires(expires);
            const updateRemaining = () => {
              const remaining = Math.max(0, Math.floor((new Date(expires).getTime() - Date.now()) / 1000));
              setHoldRemaining(remaining);
              if (remaining <= 0) {
                // clear
                setHoldToken(null); setHoldExpires(null); sessionStorage.removeItem(`hold_token_${eventoId}`); sessionStorage.removeItem(`hold_expires_${eventoId}`);
              }
            };
            updateRemaining();
            const t = setInterval(updateRemaining, 1000);
            // cleanup timer when fetchData finishes
            setTimeout(() => clearInterval(t), 1000 * 60 * 60);
          }
        } catch {}
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
    // create a server-side hold for the selected seats (10 minutes)
    (async () => {
      try {
        const payload = { eventoId: evento?.id, seats: selectedSeats.map(s => ({ asientoId: s.id, precio: zonasMap[s.zonaId]?.precio || 0 })), durationMinutes: 10 };
        const holdRes: any = await reservationsApi.createHold(payload).catch((e: any) => { throw e; });
        // store hold token and expiry in sessionStorage scoped to event
        try {
          sessionStorage.setItem(`hold_token_${evento?.id}`, holdRes.token);
          sessionStorage.setItem(`hold_expires_${evento?.id}`, new Date(holdRes.expiresAt).toISOString());
        } catch {}
        navigate('/checkout', { state: { selectedSeats, evento, zonasMap, holdToken: holdRes.token, holdExpires: holdRes.expiresAt } });
      } catch (err: any) {
        console.error('Failed to create hold', err);
        // Show a more specific error message when possible
        const msg = err?.message ?? 'No se pudo reservar temporalmente los asientos.';
        if (msg.includes('401') || msg === 'SESSION_EXPIRED' || msg.includes('403')) {
          alert('Necesitas iniciar sesión como cliente para reservar asientos. Por favor inicia sesión e intenta de nuevo.');
        } else if (msg.includes('Seat already')) {
          alert('Algunos asientos ya están reservados o en hold por otro usuario. Refresca el mapa y elige otros asientos.');
        } else {
          alert(msg);
        }
      }
    })();
  };
  
  if (loading) return <div className="text-center p-10">Cargando mapa de asientos...</div>;
  if (!evento) return <div className="text-center p-10">Evento no encontrado.</div>;
  
  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
      {/* Hold banner (prominent) */}
      {holdToken && holdRemaining > 0 && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-11/12 max-w-3xl">
          <div className="bg-red-600 text-white p-3 rounded-lg shadow-lg text-center font-bold text-lg">
            ¡Asientos reservados temporalmente! Tiempo restante: {Math.floor(holdRemaining/60)}:{String(holdRemaining%60).padStart(2,'0')}
            <button className="ml-4 underline text-sm font-normal" onClick={async () => {
              try { await reservationsApi.releaseHold(holdToken); } catch {};
              sessionStorage.removeItem(`hold_token_${evento.id}`);
              sessionStorage.removeItem(`hold_expires_${evento.id}`);
              setHoldToken(null); setHoldExpires(null); setHoldRemaining(0);
              // refresh seat map
              const { seats: mappedSeats } = await eventsApi.getSeats(evento.stageId);
              setAsientos(mappedSeats);
            }}>Liberar hold</button>
          </div>
        </div>
      )}
      {/* Seat Map */}
      <div className="flex-grow p-4 overflow-auto">
        <h2 className="text-2xl font-bold text-center mb-4">Selecciona tus Asientos</h2>
        <div className="bg-base-300/50 w-full p-4 text-center text-white font-bold rounded-t-lg">ESCENARIO</div>
        <div className="p-8 bg-base-200 rounded-b-lg flex flex-col items-center gap-8 w-full">
          {/* Render each zone as a matrix: group seats by fila and sort by fila/numero */}
          {zonas.map((zona) => {
            const seatsForZone = asientos.filter(a => a.zonaId === zona.id);
            if (!seatsForZone || seatsForZone.length === 0) return null;
            // determine row ordering from seat.fila (e.g., 'R1', 'R2')
            const filaKeys = Array.from(new Set(seatsForZone.map(s => s.fila ?? ''))).filter(f => f) as string[];
            const parseFila = (f: string) => {
              const m = (f || '').toString().match(/(\d+)/);
              return m ? Number(m[1]) : 0;
            };
            filaKeys.sort((a, b) => parseFila(a) - parseFila(b));

            return (
              <div key={zona.id} className="w-full">
                <div className="flex items-center justify-between mb-2 px-4">
                  <div className="text-lg font-semibold">{zona.nombre}</div>
                  <div className="text-sm text-gray-300">Precio: ${zona.precio?.toFixed ? zona.precio.toFixed(2) : (zona.precio ?? 0)}</div>
                </div>
                <div className="inline-block bg-black p-4 rounded w-full">
                  {filaKeys.map((filaKey) => {
                    const seatsInRow = seatsForZone
                      .filter(s => s.fila === filaKey)
                      .sort((x, y) => Number(x.numero) - Number(y.numero));
                    return (
                      <div key={filaKey} className="flex gap-2 mb-2 justify-center">
                        {seatsInRow.map(seat => (
                          <Seat key={seat.id} seat={seat} zona={zonasMap[seat.zonaId]} onSelect={toggleSeatSelection} isSelected={!!selectedSeats.find(s => s.id === seat.id)} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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