
import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useKeycloak } from '../hooks/useKeycloak';
import { Button } from './ui/Button';

const UserMenu = () => {
  const { keycloakInstance, profile } = useKeycloak();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center space-x-2 text-white p-2 rounded-md hover:bg-base-300">
        <span>Hola, {profile?.firstName}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-base-200 rounded-md shadow-lg py-1 z-50">
          <Link to="/perfil" className="block px-4 py-2 text-sm text-gray-300 hover:bg-base-300" onClick={() => setIsOpen(false)}>Mi Perfil</Link>
          <button
            onClick={() => keycloakInstance.logout()}
            className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-base-300"
          >
            Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
};


export const Navbar = () => {
  const { authenticated, keycloakInstance } = useKeycloak();

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-primary text-white' : 'text-gray-300 hover:bg-base-300 hover:text-white'}`;

  return (
    <nav className="bg-base-200 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-white font-bold text-xl">
              DS-Events
            </Link>
            {authenticated && (
                <div className="hidden md:block">
                    <div className="ml-10 flex items-baseline space-x-4">
                        <NavLink to="/" className={navLinkClasses}>Inicio</NavLink>
                        <NavLink to="/perfil" className={navLinkClasses}>Mis Reservaciones</NavLink>
                    </div>
                </div>
            )}
          </div>
          <div className="flex items-center">
             {!authenticated ? (
                <div className="space-x-2">
                    <Button onClick={() => keycloakInstance.login(false)} variant="primary">Iniciar Sesión (Cliente)</Button>
                    <Button onClick={() => keycloakInstance.login(true)} variant="secondary">Iniciar Sesión (Admin)</Button>
                </div>
            ) : (
                <UserMenu />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
