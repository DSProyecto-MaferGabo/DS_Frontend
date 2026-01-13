
import { useContext } from 'react';
import { KeycloakContext } from '../context/KeycloakContext';

export const useKeycloak = () => {
  const context = useContext(KeycloakContext);
  if (!context) {
    // Return a default context for initialization
    return {
      authenticated: false,
      keycloakInstance: {} as any,
      profile: null,
      isInitializing: true,
      userRecord: null,
      permissions: null,
      isLoadingUserContext: false,
      refreshUserContext: async () => {}
    };
  }
  return context;
};
