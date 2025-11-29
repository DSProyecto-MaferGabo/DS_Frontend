import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import type { Usuario } from '../../types';
import { Button } from '../../components/ui/Button';

export const UserManagementPage = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    try {
  const data = await api.get<Usuario[]>('/User');
      setUsuarios(data);
      setForbidden(false);
    } catch (error) {
      // If backend returns 403 we likely are not authenticated as admin
      if (String(error.message || '').includes('403')) {
        setForbidden(true);
      } else {
        console.error('Error fetching usuarios:', error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  if (loading) return <p>Cargando usuarios...</p>;


  if (forbidden) return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-4">Gestión de Usuarios</h1>
      <div className="bg-yellow-500/10 p-4 rounded">
        <p className="text-yellow-300">No tienes permisos para listar usuarios (403). Inicia sesión como administrador para ver y gestionar usuarios.</p>
      </div>
    </div>
  );
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
        <Button variant="primary" disabled>Crear Usuario</Button>
      </div>
      <div className="bg-base-200 shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-base-300">
            <tr>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm">ID</th>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm">Nombre</th>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm">Email</th>
              <th className="text-left py-3 px-4 uppercase font-semibold text-sm">Acciones</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {usuarios.map((usuario) => (
              <tr key={usuario.id} className="border-b border-base-300 hover:bg-base-300/50">
                <td className="py-3 px-4 font-mono text-sm">{usuario.id}</td>
                <td className="py-3 px-4">{usuario.nombre}</td>
                <td className="py-3 px-4">{usuario.email}</td>
                <td className="py-3 px-4">
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm" onClick={async () => {
                      const newName = window.prompt('Nuevo nombre', usuario.nombre);
                      const newEmail = window.prompt('Nuevo email', usuario.email);
                      if (!newName || !newEmail) return;
                      try {
                        await api.put(`/User/${usuario.id}`, { Name: newName, Email: newEmail, Active: true, RoleId: (usuario as any).roleId || 1 });
                        fetchUsuarios();
                        alert('Usuario actualizado');
                      } catch (err: any) {
                        console.error('Update failed', err);
                        alert(`Update failed: ${err.status || ''} ${JSON.stringify(err.body || err.message)}`);
                      }
                    }}>Editar</Button>
                    <Button variant="danger" size="sm" onClick={async () => {
                      if (!window.confirm(`Eliminar usuario ${usuario.email}?`)) return;
                      try {
                        await api.delete(`/User/${usuario.id}`);
                        setUsuarios(prev => prev.filter(u => u.id !== usuario.id));
                      } catch (err: any) {
                        console.error('Delete failed', err);
                        alert(`Delete failed: ${err.status || ''} ${JSON.stringify(err.body || err.message)}`);
                      }
                    }}>Eliminar</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
