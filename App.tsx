import React from 'react';
import { HashRouter } from 'react-router-dom';
import { KeycloakProvider } from './context/KeycloakContext';
import { Router } from './Router';

const App = () => {
  return (
    <KeycloakProvider>
      <HashRouter>
        <Router />
      </HashRouter>
    </KeycloakProvider>
  );
};

export default App;