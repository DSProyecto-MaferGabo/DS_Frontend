import React, { useEffect, useState, useCallback } from 'react';
import eventsApi from '../../services/eventsApi';
import { Button } from '../../components/ui/Button';
import type { EventRequest } from '../../types';

const EventRequestsAdminPage = () => {
  const [requests, setRequests] = useState<EventRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await eventsApi.getPendingEventRequests();
      setRequests(data || []);
    } catch (err) {
      console.error('No se pudieron cargar solicitudes', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: number) => {
    setApprovingId(id);
    try {
      await eventsApi.approveEventRequest(id);
      await load();
    } catch (err) {
      alert('No se pudo aprobar la solicitud');
      console.error(err);
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) return <div className="p-4">Cargando solicitudes...</div>;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Solicitudes de Eventos</h1>
        <span className="text-sm text-gray-400">Pendientes: {requests.length}</span>
      </div>
      {requests.length === 0 ? (
        <div className="text-gray-400">No hay solicitudes pendientes.</div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="bg-base-200 rounded-lg p-4 flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-lg font-semibold">{r.name}</div>
                  <div className="text-sm text-gray-400">{r.date} · {r.eventFormat}</div>
                  <div className="text-sm text-gray-400">Categoría: {r.categoryId ?? 'N/D'} · Stage: {r.stageId}</div>
                </div>
                <Button
                  variant="success"
                  size="sm"
                  disabled={approvingId === r.id}
                  onClick={() => approve(r.id)}
                >
                  {approvingId === r.id ? 'Aprobando...' : 'Aprobar'}
                </Button>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{r.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventRequestsAdminPage;
