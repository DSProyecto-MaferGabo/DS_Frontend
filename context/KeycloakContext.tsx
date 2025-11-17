
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import keycloak from '../services/keycloakService';
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
    keycloak.init((authStatus) => {
        setAuthenticated(authStatus);
        setProfile(keycloak.profile);
    }).then(() => {
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
