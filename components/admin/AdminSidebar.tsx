import React from 'react';
import { NavLink } from 'react-router-dom';
import { useKeycloak } from '../../hooks/useKeycloak';
import {
  CalendarIcon,
  UsersIcon,
  TicketIcon,
  CreditCardIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  TagIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { name: 'Eventos', href: '/admin/eventos', icon: CalendarIcon, active: true },
    { name: 'Escenarios', href: '/admin/escenarios', icon: CalendarIcon, active: true },
  { name: 'Usuarios', href: '/admin/usuarios', icon: UsersIcon, active: true },
    { name: 'Servicios', href: '/admin/servicios', icon: CreditCardIcon, active: true },
  { name: 'Categorías', href: '/admin/categorias', icon: TagIcon, active: true },
  { name: 'Reservaciones', href: '/admin/reservaciones', icon: TicketIcon, active: true },
  { name: 'Pagos', href: '/admin/pagos', icon: CreditCardIcon, active: false },
  { name: 'Reportes', href: '/admin/reportes', icon: ChartBarIcon, active: false },
  { name: 'Foros', href: '/admin/foros', icon: ChatBubbleLeftRightIcon, active: false },
];

export const AdminSidebar = () => {
  const { profile, authenticated, keycloakInstance } = useKeycloak();

  const AuthGreeting = () => (
    <div className="bg-base-100 p-3 rounded">
      {authenticated && profile ? (
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">Hola, <span className="font-semibold">{profile.username || profile.firstName || 'User'}</span></div>
            <div className="text-xs text-gray-400">{(profile.roles || []).join(', ')}</div>
          </div>
          <div>
            <button onClick={() => keycloakInstance.logout()} className="text-sm text-red-400 hover:text-red-300">Cerrar</button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-400">No autenticado</div>
      )}
    </div>
  );
  const linkClasses = ({ isActive }: { isActive: boolean }, active: boolean) =>
    `flex items-center px-4 py-3 rounded-lg transition-colors duration-200 ${
      !active
        ? 'text-gray-500 cursor-not-allowed'
        : isActive
        ? 'bg-primary text-white shadow-lg'
        : 'text-gray-300 hover:bg-base-300 hover:text-white'
    }`;

  return (
    <aside className="w-64 bg-base-200 p-4 flex flex-col h-screen fixed">
      <div className="px-2 mb-4">
        <h2 className="text-2xl font-bold text-white">Admin Panel</h2>
        <p className="text-sm text-gray-400">Gestión de Eventos</p>
      </div>
      <div className="px-2 mb-6">
        {/* Greeting + logout */}
        <AuthGreeting />
      </div>
      <nav className="flex-grow">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.href}
                className={(props) => linkClasses(props, item.active)}
                onClick={(e) => !item.active && e.preventDefault()}
              >
                <item.icon className="h-6 w-6 mr-3" />
                <span>{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto">
        <NavLink
            to="/"
            className="flex items-center px-4 py-3 rounded-lg text-gray-300 hover:bg-base-300 hover:text-white"
            >
            <HomeIcon className="h-6 w-6 mr-3" />
            <span>Volver al Sitio</span>
        </NavLink>
      </div>
    </aside>
  );
};
