import React from 'react';
import { useKeycloak } from '../../hooks/useKeycloak';
import { Button } from '../ui/Button';
import { XMarkIcon } from '@heroicons/react/24/solid';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal = ({ isOpen, onClose }: LoginModalProps) => {
  const { keycloakInstance } = useKeycloak();

  if (!isOpen) {
    return null;
  }
  
  const handleLogin = (isAdmin: boolean) => {
    keycloakInstance.login(isAdmin);
    onClose();
  };

  const handleRegister = () => {
    // redirect to Keycloak registration page
    // this requires 'User Registration' to be enabled in the realm
    keycloakInstance.register();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity"
      onClick={onClose}
    >
      <div 
        className="bg-base-200 rounded-lg shadow-xl p-8 w-full max-w-md m-4 relative transform transition-all"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
            <XMarkIcon className="h-6 w-6" />
        </button>
        <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Inicia Sesión</h2>
            <p className="text-gray-400 mb-6">Para comprar entradas y acceder a tu perfil.</p>
            <div className="space-y-4">
         <Button onClick={() => handleLogin(false)} variant="primary" size="lg" className="w-full">
          Iniciar Sesión con Keycloak
        </Button>
            </div>
        </div>
      </div>
    </div>
  );
};
