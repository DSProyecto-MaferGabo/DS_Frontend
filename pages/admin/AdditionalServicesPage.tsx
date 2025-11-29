import React, { useState, useEffect } from 'react';
import reservationsApi from '../../services/reservationsApi';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { useKeycloak } from '../../hooks/useKeycloak';

export const AdditionalServicesPage = () => {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '', price: 0 });
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', price: 0 });
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await reservationsApi.getAdditionalServices();
        if (mounted) {
          // reservationsApi returns normalized objects
          setServices(s || []);
        }
      } catch (e) {
        console.error('failed load services', e);
        if (mounted) setMessage({ type: 'error', text: 'Error cargando servicios' });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const showMessage = (type: 'success' | 'error', text: string, timeout = 3000) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), timeout);
  };

  const handleCreate = async () => {
    if (!form.name || form.name.trim().length === 0) {
      showMessage('error', 'El nombre es requerido');
      return;
    }
    if (Number.isNaN(form.price) || form.price < 0) {
      showMessage('error', 'El precio debe ser un número mayor o igual a 0');
      return;
    }
    setCreating(true);
    try {
      await reservationsApi.createAdditionalService(form);
      const s = await reservationsApi.getAdditionalServices();
      setServices(s || []);
      setForm({ name: '', description: '', price: 0 });
      showMessage('success', 'Servicio creado');
    } catch (e) {
      console.error(e);
      showMessage('error', 'Error creando servicio');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (s: any) => {
    setEditingId(s.Id);
    setEditForm({ name: s.Name ?? '', description: s.Description ?? '', price: s.Price ?? 0 });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', description: '', price: 0 });
  };

  const handleSave = async (id: number) => {
    if (!editForm.name || editForm.name.trim().length === 0) {
      showMessage('error', 'El nombre es requerido');
      return;
    }
    if (Number.isNaN(editForm.price) || editForm.price < 0) {
      showMessage('error', 'El precio debe ser un número mayor o igual a 0');
      return;
    }
    setSavingId(id);
    try {
      await reservationsApi.updateAdditionalService(id, editForm);
      setServices(prev => prev.map(p => p.Id === id ? { ...p, Name: editForm.name, Description: editForm.description, Price: editForm.price } : p));
      showMessage('success', 'Servicio actualizado');
      cancelEdit();
    } catch (e) {
      console.error(e);
      showMessage('error', 'Error actualizando servicio');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = window.confirm('Eliminar servicio? Esta acción no se puede deshacer.');
    if (!ok) return;
    setDeletingId(id);
    try {
      await reservationsApi.deleteAdditionalService(id);
      setServices(prev => prev.filter(p => p.Id !== id));
      showMessage('success', 'Servicio eliminado');
    } catch (e) {
      console.error(e);
      showMessage('error', 'Error eliminando servicio');
    } finally {
      setDeletingId(null);
    }
  };

  const { profile, keycloakInstance } = useKeycloak();
  const isAdmin = keycloakInstance?.hasRealmRole('administrador') || keycloakInstance?.hasRealmRole('admin');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <BackButton />
          <h1 className="text-3xl font-bold">Servicios Adicionales</h1>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowCreate(prev => !prev)} variant="primary">
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
                  Crear Servicio
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-200 text-green-900' : 'bg-red-200 text-red-900'}`}>
          {message.text}
        </div>
      )}
      {/* Create form (toggle) */}
      {showCreate && (
        <div className="bg-base-200 p-4 rounded-lg mb-6">
          <h2 className="font-semibold mb-3">Crear Servicio</h2>
          {isAdmin ? (
            <div className="space-y-2">
              <input className="w-full p-2 rounded bg-base-100" placeholder="Nombre" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <textarea className="w-full p-2 rounded bg-base-100" placeholder="Descripción" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              <input type="number" className="w-full p-2 rounded bg-base-100" placeholder="Precio" value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})} />
              <div className="text-right">
                <Button variant="primary" onClick={async () => { await handleCreate(); setShowCreate(false); }} disabled={creating}>{creating ? 'Creando...' : 'Crear'}</Button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded bg-yellow-100 text-yellow-900">Solo administradores pueden crear servicios.</div>
          )}
        </div>
      )}

      {/* Services grid */}
      <div className="grid grid-cols-3 gap-4">
        {loading ? <p>Cargando...</p> : (
          services.map(s => (
            <div key={s.Id} className="bg-base-300 rounded-lg overflow-hidden shadow-lg">
              <div className="h-24 flex items-center justify-center bg-base-200">
                {editingId === s.Id ? (
                  <input
                    className="text-xl font-bold bg-transparent text-center w-full px-4"
                    value={editForm.name}
                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    aria-label={`Nombre servicio ${s.Id}`}
                  />
                ) : (
                  <div className="text-xl font-bold">{s.Name}</div>
                )}
              </div>
              <div className="p-4 flex justify-between items-start">
                <div className="flex-1 pr-4">
                  {editingId === s.Id ? (
                    <textarea
                      className="w-full p-2 rounded bg-base-100"
                      value={editForm.description}
                      onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      aria-label={`Descripción servicio ${s.Id}`}
                    />
                  ) : (
                    <div className="text-sm text-gray-400">{s.Description}</div>
                  )}
                </div>
                <div className="ml-4 text-right flex flex-col items-end gap-2" style={{minWidth:120}}>
                  {editingId === s.Id ? (
                    <input
                      type="number"
                      className="w-32 p-2 rounded bg-base-100 text-right"
                      value={String(editForm.price)}
                      onChange={e => setEditForm(prev => ({ ...prev, price: Number(e.target.value) }))}
                      aria-label={`Precio servicio ${s.Id}`}
                    />
                  ) : (
                    <div className="font-semibold">${s.Price}</div>
                  )}
                  {editingId === s.Id ? (
                    <div className="flex items-center space-x-2">
                      <Button variant="primary" size="sm" onClick={() => handleSave(s.Id)} disabled={savingId === s.Id} aria-label="Guardar servicio">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={cancelEdit} aria-label="Cancelar edición">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
                    </div>
                  ) : (
                    isAdmin && (
                      <div className="flex items-center space-x-2">
                        <Button onClick={() => startEdit(s)} variant="ghost" size="sm" aria-label="Editar servicio">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 13.5V19h5.5L19.5 8.999l-5.5-5.5L4 13.5z" />
                          </svg>
                        </Button>
                        <Button onClick={() => handleDelete(s.Id)} variant="danger" size="sm" disabled={deletingId === s.Id} aria-label="Eliminar servicio">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6" />
                          </svg>
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
