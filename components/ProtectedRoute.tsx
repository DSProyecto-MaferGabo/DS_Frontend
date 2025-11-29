import React, { ReactElement, useEffect } from 'react';
import { useKeycloak } from '../hooks/useKeycloak';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactElement;
  roles?: string[]; // For role-based authorization
  loginRequired?: boolean; // For authentication checks
}

export const ProtectedRoute = ({ children, roles = [], loginRequired = false }: ProtectedRouteProps) => {
  const { authenticated, keycloakInstance, isInitializing } = useKeycloak();
  const location = useLocation();

  useEffect(() => {
    if (!isInitializing && loginRequired && !authenticated) {
      keycloakInstance.login();
    }
  }, [isInitializing, loginRequired, authenticated, keycloakInstance]);

  if (isInitializing) {
    return <div className="flex items-center justify-center h-screen"><p className="text-xl">Verificando sesión...</p></div>;
  }

  // Handle role-based protection for admin routes
  if (roles.length > 0) {
    if (!authenticated) {
      // Not logged in, redirect to home. The login prompt is on the navbar.
      return <Navigate to="/" state={{ from: location }} replace />;
    }
    const hasRequiredRole = roles.some(role => keycloakInstance.hasRealmRole(role));
    if (!hasRequiredRole) {
      // Logged in, but wrong role. Redirect to home.
      return <Navigate to="/" state={{ from: location }} replace />;
    }
  }
  
  // Handle simple authentication check for client routes
  if (loginRequired) {
    if (!authenticated) {
      // The useEffect above has already triggered the login.
      // Show a placeholder while redirecting.
      return <div className="flex items-center justify-center h-screen"><p className="text-xl">Redirigiendo a inicio de sesión...</p></div>;
    }
  }

  return children;
};
