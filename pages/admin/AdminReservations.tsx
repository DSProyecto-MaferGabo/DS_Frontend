
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import type { Reservacion, Evento, Usuario } from '../../types';

interface PopulatedReservacion extends Reservacion {
    evento?: Evento;
    usuario?: Usuario;
}

export const AdminReservations = () => {
    const [reservaciones, setReservaciones] = useState<PopulatedReservacion[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchReservaciones = useCallback(async () => {
        setLoading(true);
        try {
            const [reservacionesData, eventosData, usuariosData] = await Promise.all([
                api.get<Reservacion[]>('/reservaciones'),
                api.get<Evento[]>('/eventos'),
                api.get<Usuario[]>('/usuarios')
            ]);

            const eventosMap = new Map(eventosData.map(e => [e.id, e]));
            const usuariosMap = new Map(usuariosData.map(u => [u.id, u]));

            const populatedData = reservacionesData.map(res => ({
                ...res,
                evento: eventosMap.get(res.eventoId),
                usuario: usuariosMap.get(res.usuarioId)
            }));
            
            setReservaciones(populatedData);
        } catch (error) {
            console.error('Error fetching reservations:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReservaciones();
    }, [fetchReservaciones]);

    if (loading) return <p>Cargando reservaciones...</p>;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Gestión de Reservaciones</h1>
            <div className="bg-base-200 shadow-md rounded-lg overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-base-300">
                        <tr>
                            <th className="text-left py-3 px-4">ID Reserva</th>
                            <th className="text-left py-3 px-4">Evento</th>
                            <th className="text-left py-3 px-4">Usuario</th>
                            <th className="text-left py-3 px-4">Asientos</th>
                            <th className="text-left py-3 px-4">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reservaciones.map((res) => (
                            <tr key={res.id} className="border-b border-base-300 hover:bg-base-300/50">
                                <td className="py-3 px-4">{res.id}</td>
                                <td className="py-3 px-4">{res.evento?.nombre || 'N/A'}</td>
                                <td className="py-3 px-4">{res.usuario?.nombre || 'N/A'}</td>
                                <td className="py-3 px-4">{res.asientos}</td>
                                <td className="py-3 px-4">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                        res.estado === 'CONFIRMADA' ? 'bg-green-500/20 text-green-300' :
                                        res.estado === 'PENDIENTE' ? 'bg-yellow-500/20 text-yellow-300' :
                                        'bg-gray-500/20 text-gray-300'
                                    }`}>
                                        {res.estado}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
