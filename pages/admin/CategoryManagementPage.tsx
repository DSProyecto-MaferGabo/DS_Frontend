import React, { useEffect, useState } from 'react';
import eventsApi from '../../services/eventsApi';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useKeycloak } from '../../hooks/useKeycloak';

export const CategoryManagementPage = () => {
  const [categories, setCategories] = useState<{ id: number; name: string; description?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const [eventsCount, setEventsCount] = useState<Record<number, number>>({});
  const { keycloakInstance } = useKeycloak();
  const isAdmin = keycloakInstance?.hasRealmRole?.('administrador') || false;

  const fetch = async () => {
    setLoading(true);
    try {
      const cats = await eventsApi.getCategories();
      setCategories(cats.map((c: any) => ({ id: c.id, name: c.name, description: c.description || '' })));
      // fetch organizer's events to compute per-category counts (used in the UI)
      try {
        const myEvents = await eventsApi.getMyEvents();
        const map: Record<number, number> = {};
        (myEvents || []).forEach((e: any) => { if (e.categoryId) { map[Number(e.categoryId)] = (map[Number(e.categoryId)] || 0) + 1; } });
        setEventsCount(map);
      } catch (e) {
        console.warn('Could not fetch events to compute counts', e);
      }
    } catch (err) {
      console.error('Error loading categories', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const startCreate = () => {
    setEditing(null);
    setFormName('');
    setFormDescription('');
  };

  const startEdit = (cat: any) => {
    setEditing(cat.id);
    setFormName(cat.name || '');
    setFormDescription(cat.description || '');
  };

  const submit = async () => {
    try {
      if (!formName.trim()) return alert('El nombre es requerido');
      if (editing == null) {
        await eventsApi.createCategory({ name: formName.trim(), description: formDescription.trim() });
      } else {
        await eventsApi.updateCategory(editing, { name: formName.trim(), description: formDescription.trim() });
      }
      await fetch();
      startCreate();
    } catch (err: any) {
      console.error('Error saving category', err);
      if (err?.message === 'SESSION_EXPIRED') {
        if (confirm('Tu sesión expiró. ¿Quieres iniciar sesión otra vez?')) {
          (await import('../../services/keycloakService')).default.login();
        }
      } else {
        alert('No se pudo guardar la categoría');
      }
    }
  };

  const remove = async (id: number) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    try {
      await eventsApi.deleteCategory(id);
      await fetch();
    } catch (err) {
      console.error('Error deleting category', err);
      alert('No se pudo eliminar la categoría');
    }
  };



  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gestión de Categorías</h1>
        {isAdmin && (
          <Button onClick={() => { setShowCreate(prev => !prev); startCreate(); }} variant="primary">
            {showCreate ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Ocultar formulario
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nueva Categoría
              </>
            )}
          </Button>
        )}
      </div>

      {/* Create/Edit form (toggleable) - only for admins */}
      {isAdmin && (showCreate || editing != null) && (
        <div className="bg-base-200 p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">{editing ? 'Editar categoría' : 'Crear nueva categoría'}</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Nombre</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full p-2 bg-base-100 rounded" />
            </div>
            <div>
              <label className="block text-sm mb-1">Descripción (opcional)</label>
              <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} className="w-full p-2 bg-base-100 rounded" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={startCreate}>Limpiar</Button>
              <Button variant="primary" onClick={submit}>{editing ? 'Guardar cambios' : 'Crear'}</Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="col-span-1 md:col-span-3">
          {loading ? (
            <p>Cargando categorías...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {categories.map(cat => (
                <div key={cat.id} className="bg-base-200 rounded-lg overflow-hidden shadow-lg">
                  <button onClick={() => navigate(`/admin/categorias/${cat.id}/eventos`)} className="w-full text-left">
                    <div className="h-24 flex items-center justify-between bg-base-300 px-4">
                      <div className="text-xl font-bold">{cat.name}</div>
                      <div className="text-sm text-gray-400">{eventsCount[cat.id] || 0} eventos</div>
                    </div>
                    <div className="p-4 flex justify-between items-start">
                      <div>
                        <div className="text-sm text-gray-400">{cat.description}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {isAdmin && (
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); startEdit(cat); }} aria-label="Editar categoría">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 13.5V19h5.5L19.5 8.999l-5.5-5.5L4 13.5z" />
                              </svg>
                            </Button>
                            <Button variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); remove(cat.id); }} aria-label="Eliminar categoría">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6" />
                              </svg>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryManagementPage;
