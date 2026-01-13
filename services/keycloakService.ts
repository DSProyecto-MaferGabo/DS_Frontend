import Keycloak, { KeycloakInstance } from 'keycloak-js';
import type { KeycloakProfile } from '../types';

// Prefer new Keycloak base URL without /auth (Keycloak 18+), fallback to legacy
const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'ds-repo1';
const KEYCLOAK_CLIENT = import.meta.env.VITE_KEYCLOAK_CLIENT || 'frontend-spa';

class KeycloakService {
  private kc: KeycloakInstance;
  public authenticated = false;
  public token = '';
  public profile: KeycloakProfile | null = null;
  private onAuthChange: ((authenticated: boolean) => void) | null = null;

  constructor() {
    this.kc = new Keycloak({
      url: KEYCLOAK_URL,
      realm: KEYCLOAK_REALM,
      clientId: KEYCLOAK_CLIENT
    });
  }

  private mapProfile = (p: any): KeycloakProfile => {
    return {
      id: p.id || p.sub || '',
      username: p.username || p.preferred_username || '',
      firstName: p.firstName || p.given_name || '',
      lastName: p.lastName || p.family_name || '',
      email: p.email || '',
      emailVerified: !!p.email_verified,
      roles: (this.kc.tokenParsed as any)?.realm_access?.roles || []
    };
  };

  async init(onAuthChange?: (authenticated: boolean) => void) {
    if (onAuthChange) this.onAuthChange = onAuthChange;

    // Build silent check SSO redirect URI so keycloak-js can do the check in an iframe
    const silentUri = `${window.location.origin}/silent-check-sso.html`;
    console.debug('[Keycloak] init() options:', { onLoad: 'check-sso', pkceMethod: 'S256', checkLoginIframe: false, silentCheckSsoRedirectUri: silentUri });

    // Use check-sso so we don't force login on page load. Provide silentCheckSsoRedirectUri
    // so the library can perform the silent SSO inside an iframe instead of redirecting.
    // Wrap in try/catch so we don't leave the app initializing indefinitely if Keycloak is unreachable.
    let authenticated = false;
    // Add a temporary listener for postMessage events so we can debug silent iframe responses
    const msgHandler = (ev: MessageEvent) => {
      try {
        console.debug('[Keycloak] received postMessage from', ev.origin, 'data=', ev.data);
      } catch (e) {
        console.debug('[Keycloak] received postMessage (unserializable)');
      }
    };
    window.addEventListener('message', msgHandler);
    try {
      authenticated = await this.kc.init({
        onLoad: 'login-required',
        pkceMethod: 'S256',
        checkLoginIframe: false,
        silentCheckSsoRedirectUri: silentUri,
        checkLoginIframeInterval: 60,
        enableLogging: false,
        flow: 'standard'
      });
    } catch (err) {
      console.error('[Keycloak] init() failed:', err);
      authenticated = false;
    } finally {
      // remove debug listener
      window.removeEventListener('message', msgHandler);
    }
    this.authenticated = authenticated;
    this.token = this.kc.token || '';

    if (authenticated) {
      try {
        const p = await this.kc.loadUserProfile();
        this.profile = this.mapProfile(p as any);
      } catch (err) {
        // If loadUserProfile fails, still try to construct profile from token
        this.profile = this.mapProfile((this.kc.tokenParsed as any) || {});
      }
    } else {
      this.profile = null;
    }

    if (this.onAuthChange) this.onAuthChange(this.authenticated);
    return this.authenticated;
  }

  // Ensure token is valid, try to refresh if close to expiry. Returns true if token is valid after call.
  async ensureTokenValid(minValiditySeconds = 30): Promise<boolean> {
    try {
      // keycloak-js exposes updateToken which returns a Promise<boolean> in newer versions
      if (typeof (this.kc as any).updateToken === 'function') {
        const refreshed = await (this.kc as any).updateToken(minValiditySeconds);
        // update local token and authenticated flag
        this.token = this.kc.token || '';
        this.authenticated = !!this.kc.token;
        return !!refreshed || this.authenticated;
      }
    } catch (err) {
      console.warn('[Keycloak] token refresh failed', err);
    }
    // fallback: if we have a token and it's not expired, consider it valid
    return !!this.token;
  }

  getToken() {
    return this.token;
  }

  // keep optional parameter for compatibility with existing calls
  login(_isAdmin?: boolean) {
    console.debug('[Keycloak] login() called');
    try {
      // Attempt to create the login URL so we can log it for debugging
      // (some versions of keycloak-js provide createLoginUrl)
      // @ts-ignore
      const loginUrl = typeof this.kc.createLoginUrl === 'function' ? this.kc.createLoginUrl() : undefined;
      if (loginUrl) console.debug('[Keycloak] resolved loginUrl:', loginUrl);
    } catch (err) {
      console.warn('[Keycloak] could not create loginUrl:', err);
    }
    console.debug('[Keycloak] redirecting to Keycloak login');
    // This will redirect the browser to Keycloak's login page
    if (this.kc && typeof this.kc.login === 'function') {
      this.kc.login();
    } else {
      // fallback manual redirect
      const redirectUri = encodeURIComponent(window.location.origin);
      window.location.href = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth?client_id=${KEYCLOAK_CLIENT}&response_type=code&redirect_uri=${redirectUri}`;
    }
  }

  logout() {
    // Redirect to Keycloak logout
    this.kc.logout();
  }

  // expose register to redirect user to Keycloak registration page
  register() {
    console.debug('[Keycloak] register() called, redirecting to registration page');
    try {
      // @ts-ignore
      if (typeof this.kc.register === 'function') {
        // keycloak-js will redirect the browser to the registration page
        // keep compatibility if register is not present
        // @ts-ignore
        this.kc.register();
        return;
      }
    } catch (err) {
      console.warn('[Keycloak] register() failed:', err);
    }
    // fallback: call login (some setups expose registration via login with action)
    this.kc.login();
  }

  hasRealmRole(role: string): boolean {
    try {
      const roles = (this.kc.tokenParsed as any)?.realm_access?.roles || [];
      return roles.includes(role);
    } catch (err) {
      return false;
    }
  }

  async updateToken(minValiditySeconds: number = 30): Promise<boolean> {
    if (!this.authenticated) {
      console.warn('[Keycloak] updateToken called but user is not authenticated');
      return false;
    }
    try {
      // keycloak-js exposes updateToken which returns a Promise<boolean> in newer versions
      if (typeof (this.kc as any).updateToken === 'function') {
        console.debug(`[Keycloak] Attempting to refresh token with minValidity: ${minValiditySeconds}s`);
        const refreshed = await (this.kc as any).updateToken(minValiditySeconds);
        console.debug(`[Keycloak] Token refresh result: ${refreshed}`);
        if (refreshed) {
          this.token = this.kc.token || '';
          console.debug('[Keycloak] Token refreshed successfully');
          return true;
        } else {
          console.warn('[Keycloak] Token refresh returned false - token may have expired');
          return false;
        }
      } else {
        console.warn('[Keycloak] updateToken method not available on Keycloak instance');
        return false;
      }
    } catch (err) {
      console.error('[Keycloak] updateToken failed:', err);
      return false;
    }
  }
}

const keycloak = new KeycloakService();
export default keycloak;
