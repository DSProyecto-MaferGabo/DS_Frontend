import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  CalendarIcon,
  UsersIcon,
  TicketIcon,
  CreditCardIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { name: 'Eventos', href: '/admin/eventos', icon: CalendarIcon, active: true },
  { name: 'Usuarios', href: '/admin/usuarios', icon: UsersIcon, active: true },
  { name: 'Reservaciones', href: '/admin/reservaciones', icon: TicketIcon, active: true },
  { name: 'Pagos', href: '/admin/pagos', icon: CreditCardIcon, active: false },
  { name: 'Reportes', href: '/admin/reportes', icon: ChartBarIcon, active: false },
  { name: 'Foros', href: '/admin/foros', icon: ChatBubbleLeftRightIcon, active: false },
];

export const AdminSidebar = () => {
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
      <div className="px-2 mb-8">
        <h2 className="text-2xl font-bold text-white">Admin Panel</h2>
        <p className="text-sm text-gray-400">Gestión de Eventos</p>
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
