import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import eventsApi from '../../services/eventsApi';
import { Button } from '../../components/ui/Button';
import { useKeycloak } from '../../hooks/useKeycloak';

const CategoryEventsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { keycloakInstance, profile } = useKeycloak();
  const [events, setEvents] = useState<any[]>([]);
  const [category, setCategory] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        // Solo organizador: ver sus eventos; Admin: todos
        const isAdmin = keycloakInstance.hasRealmRole('administrador');
        const isOrganizer = keycloakInstance.hasRealmRole('organizador');
        const all = isAdmin ? await eventsApi.getEvents() : await eventsApi.getMyEvents();
        const filtered = (all || []).filter((e: any) => Number(e.categoryId) === Number(id));
        setEvents(filtered);
        // try to get category info
        const cats = await eventsApi.getCategories();
        const cat = (cats || []).find((c: any) => Number(c.id) === Number(id));
        setCategory(cat || null);
      } catch (e) {
        console.error('Error loading events for category', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Eventos en categoría: {category?.name ?? id}</h1>
          <div className="text-sm text-gray-400">{category?.description}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate('/admin/categorias')}>Volver a categorías</Button>
          <Button variant="primary" onClick={() => navigate('/admin/eventos/crear')}>Crear Evento</Button>
        </div>
      </div>

      {loading ? (
        <p>Cargando eventos...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {events.length === 0 ? (
            <p className="text-gray-400">No hay eventos en esta categoría.</p>
          ) : events.map(ev => (
            <div key={ev.id} className="bg-base-200 rounded-lg p-4 shadow flex flex-col">
              <img src={ev.posterUrl} alt={ev.nombre} className="w-full h-40 object-cover rounded mb-3" />
              <div className="flex-1">
                <div className="font-semibold text-lg">{ev.nombre}</div>
                <div className="text-sm text-gray-400">{new Date(ev.fecha).toLocaleDateString()} • {ev.ubicacion}</div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate(`/admin/eventos/${ev.id}/editar`)}>Editar</Button>
                <a className="text-primary text-sm" href={`/evento/${ev.id}`}>Ver en cliente</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryEventsPage;
