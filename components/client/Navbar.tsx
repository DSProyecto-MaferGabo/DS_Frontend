import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useKeycloak } from '../../hooks/useKeycloak';
import { Button } from '../ui/Button';
import { LoginModal } from './LoginModal';

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
        <div className="absolute right-0 mt-2 w-48 bg-base-200 rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5">
          <Link to="/perfil" className="block px-4 py-2 text-sm text-gray-300 hover:bg-primary hover:text-white" onClick={() => setIsOpen(false)}>Mi Perfil</Link>
          {keycloakInstance.hasRealmRole('administrador') && (
            <Link to="/admin" className="block px-4 py-2 text-sm text-gray-300 hover:bg-primary hover:text-white" onClick={() => setIsOpen(false)}>Panel Admin</Link>
          )}
          {keycloakInstance.hasRealmRole('organizador') && (
            <Link to="/admin/organizador" className="block px-4 py-2 text-sm text-gray-300 hover:bg-primary hover:text-white" onClick={() => setIsOpen(false)}>Panel Organizador</Link>
          )}
          <button
            onClick={() => keycloakInstance.logout()}
            className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500 hover:text-white"
          >
            Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
};


export const Navbar = () => {
  const { authenticated } = useKeycloak();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <header className="bg-base-200/80 backdrop-blur-md sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-white font-bold text-xl tracking-wider">
                DS-Events
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {!authenticated ? (
                  <Button onClick={() => setIsModalOpen(true)} variant="primary" size="sm">Iniciar Sesión</Button>
              ) : (
                  <UserMenu />
              )}
            </div>
          </div>
        </div>
      </header>
      <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
