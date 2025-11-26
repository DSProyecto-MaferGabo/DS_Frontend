
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  CalendarIcon,
  UsersIcon,
  TicketIcon,
  CreditCardIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { name: 'Eventos', href: '/admin/eventos', icon: CalendarIcon, active: true },
  { name: 'Usuarios', href: '/admin/usuarios', icon: UsersIcon, active: true },
  { name: 'Escenarios', href: '/admin/escenarios', icon: CalendarIcon, active: true },
  { name: 'Promociones', href: '/admin/promociones', icon: TicketIcon, active: true },
  { name: 'Categorías', href: '/admin/categorias', icon: ChatBubbleLeftRightIcon, active: true },
  { name: 'Asientos', href: '/admin/asientos', icon: TicketIcon, active: true },
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
        ? 'bg-primary text-white'
        : 'text-gray-300 hover:bg-base-300 hover:text-white'
    }`;

  return (
    <aside className="w-64 bg-base-200 p-4 flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-6 px-2">Admin Panel</h2>
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
    </aside>
  );
};
