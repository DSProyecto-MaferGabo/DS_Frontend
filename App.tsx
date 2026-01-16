import React from 'react';
import { HashRouter } from 'react-router-dom';
import { KeycloakProvider } from './context/KeycloakContext';
import { Router } from './Router';
import SurveyInvitationListener from './components/SurveyInvitationListener';
import { I18nProvider } from './i18n';

const App = () => {
  return (
    <I18nProvider>
      <KeycloakProvider>
        <HashRouter>
          <SurveyInvitationListener />
          <Router />
        </HashRouter>
      </KeycloakProvider>
    </I18nProvider>
  );
};

export default App;