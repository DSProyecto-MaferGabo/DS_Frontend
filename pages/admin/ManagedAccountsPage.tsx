import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ManagedUser, CreateManagedUserPayload } from '../../types';
import { createOrganizerAccount, createSupportAccount, getUsersByRole } from '../../services/api';

const PRIVILEGE_LABELS: Record<string, string> = {
  USER_READ_ALL: 'Consultar todos los usuarios',
  USER_MANAGE_STATUS: 'Activar / suspender cuentas',
  PROFILE_EDIT_OWN: 'Editar perfil propio',
  EVENT_CREATE: 'Crear eventos',
  EVENT_MANAGE_OWN: 'Gestionar eventos propios',
  EVENT_MANAGE_ALL: 'Gestionar cualquier evento',
  EVENT_READ_ALL: 'Ver todos los eventos',
  RESERVATION_CREATE: 'Crear reservaciones',
  RESERVATION_MANAGE_OWN: 'Gestionar reservaciones propias',
  RESERVATION_READ_ALL: 'Ver todas las reservaciones',
  PLATFORM_VIEW_DASHBOARD: 'Ver panel general de plataforma',
  LOGS_VIEW: 'Consultar bitácora de auditoría',
  FINANCE_CONCILIATE: 'Conciliar finanzas',
};

interface ManagedAccountsPageBaseProps {
  title: string;
  description: string;
  roleFilter: 'organizador' | 'soporte';
  highlightColor: string;
  emptyHint: string;
  privilegeHints: string[];
  createAccount: (payload: CreateManagedUserPayload) => Promise<ManagedUser>;
}

const ManagedAccountsPageBase = ({
  title,
  description,
  roleFilter,
  highlightColor,
  emptyHint,
  privilegeHints,
  createAccount,
}: ManagedAccountsPageBaseProps) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CreateManagedUserPayload>({
    email: '',
    firstName: '',
    lastName: '',
    temporaryPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsersByRole(roleFilter);
      setUsers(data || []);
    } catch (err: any) {
      console.error(`[ManagedAccountsPage] Failed to load ${roleFilter} users`, err);
      setError('No pudimos obtener la lista de usuarios.');
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = evt.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    if (!form.email || !form.firstName || !form.lastName) {
      setError('Nombre y correo son obligatorios.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: CreateManagedUserPayload = {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        temporaryPassword: form.temporaryPassword?.trim() ? form.temporaryPassword : undefined,
      };
      await createAccount(payload);
      setSuccessMessage('Cuenta creada correctamente.');
      setForm({ email: '', firstName: '', lastName: '', temporaryPassword: '' });
      await loadUsers();
    } catch (err: any) {
      console.error('Error creating account', err);
      const backendMessage = err?.body?.title || err?.body?.message || err?.message;
      setError(backendMessage || 'No pudimos crear la cuenta. Verifica que Keycloak y Users-service estén activos y que el correo no exista previamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const privilegeDescriptions = useMemo(() => privilegeHints.map((code) => ({
    code,
    description: PRIVILEGE_LABELS[code] || code,
  })), [privilegeHints]);

  return (
    <section className="space-y-10">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-wide text-primary">{roleFilter === 'organizador' ? 'Organizadores' : 'Equipo de soporte'}</p>
        <h1 className="text-3xl font-semibold text-white">{title}</h1>
        <p className="text-gray-400 max-w-3xl">{description}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <form className="bg-base-200 rounded-2xl border border-base-300 p-6 shadow-lg space-y-4" onSubmit={handleSubmit}>
          <div>
            <h2 className="text-xl font-semibold text-white">Crear nueva cuenta</h2>
            <p className="text-sm text-gray-400">Define los datos básicos y enviaremos la invitación vía correo.</p>
          </div>
          <div className="grid gap-4">
            <label className="space-y-1">
              <span className="text-sm text-gray-400">Correo</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="input input-bordered w-full"
                placeholder="persona@ejemplo.com"
                required
              />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="text-sm text-gray-400">Nombre</span>
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  className="input input-bordered w-full"
                  placeholder="Nombre"
                  required
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-gray-400">Apellido</span>
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  className="input input-bordered w-full"
                  placeholder="Apellidos"
                  required
                />
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-sm text-gray-400">Contraseña temporal (opcional)</span>
              <input
                type="text"
                name="temporaryPassword"
                value={form.temporaryPassword}
                onChange={handleChange}
                className="input input-bordered w-full"
                placeholder="Se generará una contraseña aleatoria si lo dejas vacío"
              />
            </label>
          </div>
          {error && (
            <div className="alert alert-error text-sm">
              <span>{error}</span>
            </div>
          )}
          {successMessage && (
            <div className="alert alert-success text-sm">
              <span>{successMessage}</span>
            </div>
          )}
          <button className={`btn ${submitting ? 'btn-disabled' : 'btn-primary'} w-full`} type="submit" disabled={submitting}>
            {submitting ? 'Creando...' : 'Registrar cuenta'}
          </button>
        </form>

        <div className="bg-base-200 rounded-2xl border border-base-300 p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Privilegios clave</h2>
              <p className="text-sm text-gray-400">Los roles obtienen automáticamente estos permisos.</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${highlightColor}`}>
              Rol: {roleFilter}
            </span>
          </div>
          <ul className="space-y-2">
            {privilegeDescriptions.map(({ code, description }) => (
              <li key={code} className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-primary"></span>
                <div>
                  <p className="text-sm text-white font-medium">{code}</p>
                  <p className="text-xs text-gray-400">{description}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500">{emptyHint}</p>
        </div>
      </div>

      <div className="bg-base-200 rounded-2xl border border-base-300 shadow-lg">
        <div className="p-6 border-b border-base-300 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Cuentas registradas</h2>
            <p className="text-sm text-gray-400">{users.length} registro(s)</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={loadUsers} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar lista'}
          </button>
        </div>
        {loading ? (
          <div className="p-6 text-gray-400">Cargando usuarios...</div>
        ) : users.length === 0 ? (
          <div className="p-6 text-gray-400">Aún no hay cuentas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-base-300">
              <thead className="bg-base-300 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-left">Correo</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-mono text-xs">{user.id}</td>
                    <td className="px-4 py-3">{user.name}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${user.active ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {user.active ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export const OrganizerAccountsPage = () => (
  <ManagedAccountsPageBase
    title="Gestión de organizadores"
    description="Administra las cuentas con permisos para crear y operar eventos. Estas cuentas sincronizan privilegios con Users-service."
    roleFilter="organizador"
    highlightColor="bg-primary/20 text-primary"
    emptyHint="Los organizadores reciben EVENT_MANAGE_OWN y EVENT_CREATE automáticamente."
    privilegeHints={[
      'EVENT_CREATE',
      'EVENT_MANAGE_OWN',
      'RESERVATION_READ_ALL',
      'PROFILE_EDIT_OWN',
    ]}
    createAccount={createOrganizerAccount}
  />
);

export const SupportAccountsPage = () => (
  <ManagedAccountsPageBase
    title="Gestión de soporte"
    description="Crea usuarios orientados a soporte operativo. Podrán ver la bitácora y los estados de reservaciones."
    roleFilter="soporte"
    highlightColor="bg-blue-500/20 text-blue-200"
    emptyHint="El rol soporte incluye USER_READ_ALL, LOGS_VIEW y acceso al panel de plataforma."
    privilegeHints={[
      'USER_READ_ALL',
      'USER_MANAGE_STATUS',
      'RESERVATION_READ_ALL',
      'LOGS_VIEW',
      'PLATFORM_VIEW_DASHBOARD',
    ]}
    createAccount={createSupportAccount}
  />
);

export default OrganizerAccountsPage;
