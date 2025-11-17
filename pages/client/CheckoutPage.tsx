import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Asiento, Evento, Zona, Reservacion } from '../../types';
import { Button } from '../../components/ui/Button';
import { useKeycloak } from '../../hooks/useKeycloak';
import api from '../../services/api';

export const CheckoutPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useKeycloak();
  
  const {
    selectedSeats,
    evento,
    zonasMap,
  }: {
    selectedSeats: Asiento[];
    evento: Evento;
    zonasMap: Record<number, Zona>;
  } = location.state || { selectedSeats: [], evento: null, zonasMap: {} };

  if (!evento || selectedSeats.length === 0) {
    return (
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold">No has seleccionado asientos.</h1>
        <Button onClick={() => navigate('/')} className="mt-4">Volver al inicio</Button>
      </div>
    );
  }

  const subtotal = selectedSeats.reduce((acc, seat) => acc + (zonasMap[seat.zonaId]?.precio || 0), 0);
  const serviceFee = subtotal * 0.10; // 10% service fee
  const total = subtotal + serviceFee;
  
  const handleConfirmReservation = async () => {
    if (!profile) return;
    try {
        // 1. Create the main reservation
        // FIX: Specify the return type for api.post to avoid 'newReservation' being of type 'unknown'.
        const newReservation = await api.post<Reservacion>('/reservaciones', {
            usuarioId: profile.id,
            eventoId: evento.id,
            estado: 'CONFIRMADA',
            total: total,
            fecha: new Date().toISOString(),
        });

        // 2. Create reservation details and update seat status
        await Promise.all(selectedSeats.map(seat => {
            return api.post('/reservaciones_detalle', {
                reservacionId: newReservation.id,
                asientoId: seat.id,
                precio: zonasMap[seat.zonaId].precio,
            });
        }));
        
        await Promise.all(selectedSeats.map(seat => {
            return api.put(`/asientos/${seat.id}`, { ...seat, estado: 'ocupado' });
        }));

        alert('¡Reservación confirmada con éxito!');
        navigate('/perfil');

    } catch (error) {
        console.error("Error confirming reservation:", error);
        alert('Hubo un error al confirmar tu reservación.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
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
        <div className="space-y-2 text-lg">
            <div className="flex justify-between font-medium">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
            </div>
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