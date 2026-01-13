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
  ShieldCheckIcon,
  SparklesIcon,
  ClipboardDocumentListIcon,
  UserPlusIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';

type NavItem = {
  name: string;
  href: string;
  icon: (props: React.ComponentProps<'svg'>) => JSX.Element;
  active: boolean;
  roles?: string[];
};

const navItems: NavItem[] = [
  { name: 'Panel Organizador', href: '/admin/organizador', icon: SparklesIcon, active: true, roles: ['administrador', 'organizador'] },
  { name: 'Panel Soporte', href: '/admin/soporte', icon: ShieldCheckIcon, active: true, roles: ['administrador', 'soporte'] },
  { name: 'Eventos', href: '/admin/eventos', icon: CalendarIcon, active: true, roles: ['administrador', 'organizador'] },
  { name: 'Escenarios', href: '/admin/escenarios', icon: CalendarIcon, active: true, roles: ['administrador', 'organizador'] },
  { name: 'Promociones', href: '/admin/promociones', icon: TicketIcon, active: true, roles: ['administrador', 'organizador'] },
  { name: 'Usuarios', href: '/admin/usuarios', icon: UsersIcon, active: true, roles: ['administrador'] },
  { name: 'Gestión Organizadores', href: '/admin/organizers', icon: UserPlusIcon, active: true, roles: ['administrador'] },
  { name: 'Gestión Soporte', href: '/admin/support', icon: UserPlusIcon, active: true, roles: ['administrador'] },
  { name: 'Servicios', href: '/admin/servicios', icon: CreditCardIcon, active: true, roles: ['administrador', 'organizador'] },
  { name: 'Categorías', href: '/admin/categorias', icon: TagIcon, active: true, roles: ['administrador', 'organizador'] },
  { name: 'Reservaciones', href: '/admin/reservaciones', icon: TicketIcon, active: true, roles: ['administrador', 'organizador', 'soporte'] },
  { name: 'Encuestas', href: '/admin/encuestas', icon: EnvelopeIcon, active: true, roles: ['administrador', 'organizador'] },
  { name: 'Permisos', href: '/admin/permisos', icon: ClipboardDocumentListIcon, active: true },
  { name: 'Pagos', href: '/admin/pagos', icon: CreditCardIcon, active: true, roles: ['administrador', 'organizador', 'soporte'] },
  { name: 'Reportes', href: '/admin/reportes', icon: ChartBarIcon, active: true, roles: ['administrador', 'organizador', 'soporte'] },
  { name: 'Foros', href: '/admin/foros', icon: ChatBubbleLeftRightIcon, active: true, roles: ['administrador', 'organizador', 'soporte'] },
];

export const AdminSidebar = () => {
  const { profile, authenticated, keycloakInstance } = useKeycloak();
  const roleSet = new Set(profile?.roles || []);

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
          {navItems.filter((item) => !item.roles || item.roles.some((role) => roleSet.has(role))).map((item) => (
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
