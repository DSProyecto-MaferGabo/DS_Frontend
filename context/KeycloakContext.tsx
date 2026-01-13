
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import keycloak from '../services/keycloakService';
import { createUserFromAuth, getUserByEmail, getUserPermissions } from '../services/api';
import type { KeycloakProfile, ManagedUser, UserPermissions } from '../types';

interface IKeycloakContext {
  authenticated: boolean;
  keycloakInstance: typeof keycloak;
  profile: KeycloakProfile | null;
  isInitializing: boolean;
  userRecord: ManagedUser | null;
  permissions: UserPermissions | null;
  isLoadingUserContext: boolean;
  refreshUserContext: () => Promise<void>;
}

export const KeycloakContext = createContext<IKeycloakContext | undefined>(undefined);

export const KeycloakProvider = ({ children }: { children: ReactNode }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [profile, setProfile] = useState<KeycloakProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [userRecord, setUserRecord] = useState<ManagedUser | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [isLoadingUserContext, setIsLoadingUserContext] = useState(false);

  const loadUserContext = async (emailOverride?: string) => {
    if (!authenticated) {
      setUserRecord(null);
      setPermissions(null);
      return;
    }
    const email = emailOverride || keycloak.profile?.email || profile?.email || '';
    if (!email || isLoadingUserContext) {
      return;
    }
    setIsLoadingUserContext(true);
    try {
      const user = await getUserByEmail(email);
      setUserRecord(user);
      if (user?.id) {
        const perms = await getUserPermissions(user.id);
        setPermissions(perms);
      } else {
        setPermissions(null);
      }
    } catch (err) {
      console.error('[KeycloakContext] failed to load user context', err);
      setUserRecord(null);
      setPermissions(null);
    } finally {
      setIsLoadingUserContext(false);
    }
  };

  const refreshUserContext = async () => {
    const email = profile?.email || keycloak.profile?.email;
    if (!email) return;
    await loadUserContext(email);
  };

  useEffect(() => {
    // pass a callback so the service can notify us when auth state changes
    keycloak.init((authStatus) => {
        console.debug('[KeycloakContext] auth change:', authStatus);
        setAuthenticated(authStatus);
        setProfile(keycloak.profile);
        // when user becomes authenticated, ensure the user exists in Users-service
        if (authStatus && keycloak.profile) {
          const payload = {
            Email: keycloak.profile.email,
            Role: keycloak.profile.roles || [],
            DisplayName: `${keycloak.profile.firstName || ''} ${keycloak.profile.lastName || ''}`.trim(),
            PhotoURL: ''
          };
          // fire-and-forget, but log errors
          createUserFromAuth(payload).then((r) => {
            console.debug('[Users API] createUserFromAuth response:', r);
          }).catch((err) => {
            console.error('[Users API] createUserFromAuth failed:', err);
          });
        }
    }).then(() => {
      setIsInitializing(false);
    }).catch((err) => {
      console.error('[KeycloakContext] init error:', err);
      // Ensure the app doesn't stay in a perpetual loading state
      setIsInitializing(false);
    });
  }, []);

  useEffect(() => {
    if (authenticated && profile?.email) {
      loadUserContext(profile.email);
    }
    if (!authenticated) {
      setUserRecord(null);
      setPermissions(null);
    }
  }, [authenticated, profile?.email]);

  const contextValue = {
    authenticated,
    keycloakInstance: keycloak,
    profile,
    isInitializing,
    userRecord,
    permissions,
    isLoadingUserContext,
    refreshUserContext
  };

  return (
    <KeycloakContext.Provider value={contextValue}>
      {children}
    </KeycloakContext.Provider>
  );
};
