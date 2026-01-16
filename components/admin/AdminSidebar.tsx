import React from 'react';
import { NavLink } from 'react-router-dom';
import { useKeycloak } from '../../hooks/useKeycloak';
import { useI18n } from '../../i18n';
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
  { name: 'sidebar.organizer', href: '/admin/organizador', icon: SparklesIcon, active: true, roles: ['administrador', 'organizador'] },
  { name: 'sidebar.support', href: '/admin/soporte', icon: ShieldCheckIcon, active: true, roles: ['administrador', 'soporte', 'organizador'] },
  { name: 'sidebar.events', href: '/admin/eventos', icon: CalendarIcon, active: true, roles: ['administrador', 'organizador'] },
  { name: 'sidebar.eventRequests', href: '/admin/eventos/solicitudes', icon: ClipboardDocumentListIcon, active: true, roles: ['administrador', 'soporte'] },
  { name: 'sidebar.stages', href: '/admin/escenarios', icon: CalendarIcon, active: true, roles: ['administrador', 'organizador'] },
  { name: 'sidebar.promotions', href: '/admin/promociones', icon: TicketIcon, active: true, roles: ['administrador', 'organizador'] },
  { name: 'sidebar.users', href: '/admin/usuarios', icon: UsersIcon, active: true, roles: ['administrador'] },
  { name: 'sidebar.orgManagers', href: '/admin/organizers', icon: UserPlusIcon, active: true, roles: ['administrador'] },
  { name: 'sidebar.supportManagers', href: '/admin/support', icon: UserPlusIcon, active: true, roles: ['administrador'] },
  { name: 'sidebar.services', href: '/admin/servicios', icon: CreditCardIcon, active: true, roles: ['administrador', 'organizador'] },
  { name: 'sidebar.categories', href: '/admin/categorias', icon: TagIcon, active: true, roles: ['administrador', 'organizador'] },
  { name: 'sidebar.reservations', href: '/admin/reservaciones', icon: TicketIcon, active: true, roles: ['administrador', 'organizador', 'soporte'] },
  { name: 'sidebar.surveys', href: '/admin/encuestas', icon: EnvelopeIcon, active: true, roles: ['administrador', 'organizador'] },
  { name: 'sidebar.payments', href: '/admin/pagos', icon: CreditCardIcon, active: true, roles: ['administrador', 'organizador', 'soporte'] },
  { name: 'sidebar.reports', href: '/admin/reportes', icon: ChartBarIcon, active: true, roles: ['administrador', 'organizador', 'soporte'] },
  { name: 'sidebar.forums', href: '/admin/foros', icon: ChatBubbleLeftRightIcon, active: true, roles: ['administrador', 'organizador', 'soporte'] },
];

export const AdminSidebar = () => {
  const { profile, authenticated, keycloakInstance } = useKeycloak();
  const { t } = useI18n();
  const roleSet = new Set(profile?.roles || []);

  const AuthGreeting = () => (
    <div className="bg-base-100 p-3 rounded">
      {authenticated && profile ? (
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">{t('navbar.hello', { name: profile.username || profile.firstName || 'User' })}</div>
            <div className="text-xs text-gray-400">{(profile.roles || []).join(', ')}</div>
          </div>
          <div>
            <button onClick={() => keycloakInstance.logout()} className="text-sm text-red-400 hover:text-red-300">{t('navbar.logout')}</button>
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
        <h2 className="text-2xl font-bold text-white">{t('navbar.adminPanel')}</h2>
        <p className="text-sm text-gray-400">{t('admin.dashboardTitle')}</p>
      </div>
      <div className="px-2 mb-4">
        <AuthGreeting />
      </div>
      <nav className="flex-grow overflow-y-auto pr-1">
        <ul className="space-y-2 pb-4">
          {navItems.filter((item) => !item.roles || item.roles.some((role) => roleSet.has(role))).map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.href}
                className={(props) => linkClasses(props, item.active)}
                onClick={(e) => !item.active && e.preventDefault()}
              >
                <item.icon className="h-6 w-6 mr-3" />
                <span>{t(item.name as any)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-2">
        <NavLink
            to="/"
            className="flex items-center px-4 py-3 rounded-lg text-gray-300 hover:bg-base-300 hover:text-white"
            >
            <HomeIcon className="h-6 w-6 mr-3" />
            <span>{t('checkout.noSeats.backHome')}</span>
        </NavLink>
      </div>
    </aside>
  );
};
