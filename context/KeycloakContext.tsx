
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import keycloak from '../services/keycloakService';
import api, { createUserFromAuth } from '../services/api';
import type { KeycloakProfile } from '../types';

interface IKeycloakContext {
  authenticated: boolean;
  keycloakInstance: typeof keycloak;
  profile: KeycloakProfile | null;
  isInitializing: boolean;
}

export const KeycloakContext = createContext<IKeycloakContext | undefined>(undefined);

export const KeycloakProvider = ({ children }: { children: ReactNode }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [profile, setProfile] = useState<KeycloakProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

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

  const contextValue = {
    authenticated,
    keycloakInstance: keycloak,
    profile,
    isInitializing
  };

  return (
    <KeycloakContext.Provider value={contextValue}>
      {children}
    </KeycloakContext.Provider>
  );
};
