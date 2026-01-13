import React, { useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/client/Navbar';
import { useKeycloak } from '../hooks/useKeycloak';
import { BackButton } from '../components/ui/BackButton';

export const ClientLayout = () => {
  const { authenticated, keycloakInstance } = useKeycloak();
  const navigate = useNavigate();
  const prevAuthRef = useRef<boolean>(authenticated);

  // Watch for transition from not-authenticated -> authenticated and redirect by role
  useEffect(() => {
    if (!prevAuthRef.current && authenticated) {
      // Just logged in
      const isAdmin = keycloakInstance.hasRealmRole('administrador');
      const isOrganizer = keycloakInstance.hasRealmRole('organizador');
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else if (isOrganizer) {
        navigate('/admin/organizador', { replace: true });
      } else {
        // Send clients to events (home)
        navigate('/', { replace: true });
      }
    }
    prevAuthRef.current = authenticated;
  }, [authenticated, keycloakInstance, navigate]);

  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="mb-4"><BackButton /></div>
          <Outlet />
        </div>
      </main>
    </div>
  );
};
