import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import type { Usuario } from '../../types';
import { Button } from '../../components/ui/Button';

export const UserManagementPage = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Usuario[]>('/usuarios');
      setUsuarios(data);
    } catch (error) {
      console.error('Error fetching usuarios:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  if (loading) return <p>Cargando usuarios...</p>;

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
                    <Button variant="ghost" size="sm" disabled>Editar</Button>
                    <Button variant="danger" size="sm" disabled>Eliminar</Button>
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
