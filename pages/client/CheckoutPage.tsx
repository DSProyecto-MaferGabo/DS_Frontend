import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Asiento, Evento, Zona, Reservacion } from '../../types';
import { Button } from '../../components/ui/Button';
import { useKeycloak } from '../../hooks/useKeycloak';
import api from '../../services/api';
import reservationsApi from '../../services/reservationsApi';

export const CheckoutPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useKeycloak();
  
  const {
    selectedSeats,
    evento,
    zonasMap,
    holdToken,
    holdExpires,
  }: {
    selectedSeats: Asiento[];
    evento: Evento;
    zonasMap: Record<number, Zona>;
    holdToken?: string | null;
    holdExpires?: string | null;
  } = location.state || { selectedSeats: [], evento: null, zonasMap: {} };

  const [holdRemaining, setHoldRemaining] = React.useState<number>(0);

  // keep the countdown visible across checkout lifecycle
  React.useEffect(() => {
    const storedExpires = holdExpires || (evento?.id ? sessionStorage.getItem(`hold_expires_${evento.id}`) : null);
    if (!storedExpires) return;
    const update = () => {
      const remaining = Math.max(0, Math.floor((new Date(storedExpires).getTime() - Date.now()) / 1000));
      setHoldRemaining(remaining);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [holdExpires, evento?.id]);

  if (!evento || selectedSeats.length === 0) {
    return (
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold">No has seleccionado asientos.</h1>
        <Button onClick={() => navigate('/')} className="mt-4">Volver al inicio</Button>
      </div>
    );
  }

  const subtotal = selectedSeats.reduce((acc, seat) => acc + (zonasMap[seat.zonaId]?.precio || 0), 0);
  const [availableServices, setAvailableServices] = React.useState<any[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = React.useState<number[]>([]);

  const servicesTotal = selectedServiceIds.reduce((acc, id) => {
    const s = availableServices.find(x => x.Id === id);
    return acc + (s?.Price || 0);
  }, 0);

  const serviceFee = (subtotal + servicesTotal) * 0.10; // 10% service fee
  const total = subtotal + servicesTotal + serviceFee;
  
  const handleConfirmReservation = async () => {
    if (!profile) return;
    // Navigate to mock payment gateway (non-functional) where user will confirm payment
    const selectedServices = availableServices
      .filter(s => selectedServiceIds.includes(s.Id))
      .map(s => ({
        id: s.Id,
        name: s.Name,
        description: s.Description,
        price: s.Price
      }));

    navigate('/payment', {
      state: {
        selectedSeats,
        evento,
        zonasMap,
        selectedServiceIds,
        selectedServices,
        subtotal,
        servicesTotal,
        total,
        holdToken
      }
    });
  };

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const services = await reservationsApi.getAdditionalServices();
        if (mounted) setAvailableServices(services || []);
      } catch (e) {
        console.warn('Could not load additional services', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const toggleService = (id: number) => {
    setSelectedServiceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Hold banner */}
      {holdToken && holdRemaining > 0 && (
        <div className="mb-4 sticky top-4 z-30">
          <div className="bg-red-600 text-white p-3 rounded-lg shadow-md font-bold text-center">
            Asientos retenidos. Tiempo restante: {Math.floor(holdRemaining/60)}:{String(holdRemaining%60).padStart(2,'0')} — completa el pago antes de que expire.
          </div>
        </div>
      )}
      <h1 className="text-4xl font-bold text-white mb-8 border-b-2 border-primary pb-2">Confirmar Reserva</h1>
      <div className="bg-base-200 p-8 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-4">{evento.nombre}</h2>
        <div className="mb-6 border-b border-base-300 pb-6">
          <h3 className="text-xl font-semibold text-primary mb-3">Resumen del Pedido</h3>
          {selectedSeats.map(seat => (
            <div key={seat.id} className="flex justify-between items-center text-gray-300 py-1">
              <span>Asiento: {seat.fila} - {seat.numero} ({zonasMap[seat.zonaId]?.nombre})</span>
              <span>${zonasMap[seat.zonaId]?.precio.toFixed(2)}</span>
            </div>
          ))}
        </div>
        {availableServices.length > 0 && (
          <div className="mb-6 border-b border-base-300 pb-6">
            <h3 className="text-xl font-semibold text-primary mb-3">Servicios Adicionales</h3>
            <div className="space-y-2">
              {availableServices.map(s => (
                <label key={s.Id} className="flex items-center justify-between text-gray-300 py-2">
                  <div>
                    <div className="font-medium">{s.Name} <span className="text-sm text-gray-400">(${s.Price})</span></div>
                    <div className="text-sm text-gray-500">{s.Description}</div>
                  </div>
                  <input type="checkbox" checked={selectedServiceIds.includes(s.Id)} onChange={() => toggleService(s.Id)} />
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-2 text-lg">
            <div className="flex justify-between font-medium">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
            </div>
            {servicesTotal > 0 && (
              <div className="flex justify-between font-medium text-gray-200">
                <span>Servicios adicionales:</span>
                <span>${servicesTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-400">
                <span>Tasa de Servicio (10%):</span>
                <span>${serviceFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-2xl text-primary pt-4 border-t border-base-300">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
            </div>
        </div>
        <div className="mt-8 text-right">
            <Button onClick={handleConfirmReservation} size="lg" variant="primary">
                Confirmar y Pagar
            </Button>
        </div>
      </div>
    </div>
  );
};