import React, { ReactElement, useEffect, useRef } from 'react';
import { useKeycloak } from '../hooks/useKeycloak';
import { Navigate, useLocation } from 'react-router-dom';
import { createUserFromAuth } from '../services/api';

interface ProtectedRouteProps {
  children: ReactElement;
  roles?: string[]; // For role-based authorization
  loginRequired?: boolean; // For authentication checks
  privileges?: string[]; // Optional privilege-based checks coming from Users-service
}

export const ProtectedRoute = ({ children, roles = [], loginRequired = false, privileges = [] }: ProtectedRouteProps) => {
  const { authenticated, keycloakInstance, isInitializing, permissions, profile } = useKeycloak();
  const location = useLocation();
  const syncingRef = useRef(false);

  // DEBUG LOGS
  console.log('[ProtectedRoute] location:', location.pathname);
  console.log('[ProtectedRoute] authenticated:', authenticated);
  console.log('[ProtectedRoute] isInitializing:', isInitializing);
  console.log('[ProtectedRoute] roles required:', roles);
  console.log('[ProtectedRoute] privileges required:', privileges);
  console.log('[ProtectedRoute] user profile:', profile);
  console.log('[ProtectedRoute] user permissions:', permissions);

  useEffect(() => {
    if (!isInitializing && loginRequired && !authenticated) {
      keycloakInstance.login();
    }
  }, [isInitializing, loginRequired, authenticated, keycloakInstance]);

  // Auto-sync user in Users-service using the current token (align externalId/sub)
  useEffect(() => {
    const syncUser = async () => {
      if (!authenticated || !profile || syncingRef.current) return;
      syncingRef.current = true;
      try {
        await createUserFromAuth({
          Email: profile.email,
          Role: profile.roles && profile.roles.length > 0 ? profile.roles : ['cliente'],
          DisplayName: `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim(),
        } as any);
      } catch (err) {
        console.warn('[ProtectedRoute] createUserFromAuth failed (non-blocking)', err);
      } finally {
        syncingRef.current = false;
      }
    };
    syncUser();
  }, [authenticated, profile]);

  if (isInitializing) {
    return <div className="flex items-center justify-center h-screen"><p className="text-xl">Verificando sesión...</p></div>;
  }

  // Handle role-based protection for admin routes
  if (roles.length > 0) {
    if (!authenticated) {
      console.warn('[ProtectedRoute] Not authenticated, redirecting to /');
      return <Navigate to="/" state={{ from: location }} replace />;
    }
    const hasRequiredRole = roles.some(role => keycloakInstance.hasRealmRole(role));
    console.log('[ProtectedRoute] hasRequiredRole:', hasRequiredRole, 'user roles:', profile?.roles);
    if (!hasRequiredRole) {
      console.warn('[ProtectedRoute] Authenticated but missing required role, redirecting to /');
      return <Navigate to="/" state={{ from: location }} replace />;
    }
  }

  if (privileges.length > 0) {
    if (!authenticated) {
      console.warn('[ProtectedRoute] Not authenticated (privileges check), redirecting to /');
      return <Navigate to="/" state={{ from: location }} replace />;
    }
    const userPrivileges = permissions?.privileges || [];
    // If permissions are not yet loaded, allow and rely on role check above to guard access
    if (userPrivileges.length > 0) {
      const hasPrivilege = userPrivileges.some(priv => privileges.includes(priv));
      console.log('[ProtectedRoute] hasPrivilege:', hasPrivilege, 'userPrivileges:', userPrivileges);
      if (!hasPrivilege) {
        console.warn('[ProtectedRoute] Authenticated but missing required privilege, redirecting to /');
        return <Navigate to="/" state={{ from: location }} replace />;
      }
    } else {
      console.warn('[ProtectedRoute] Privileges not loaded; allowing access based on roles');
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
