import { KeycloakProfile } from '../types';

// Mock Keycloak Service to simulate authentication with 'check-sso'
class KeycloakService {
  public authenticated = false;
  public token = '';
  public profile: KeycloakProfile | null = null;
  private onAuthChange: ((authenticated: boolean) => void) | null = null;

  private setAuthState(authenticated: boolean, profile: KeycloakProfile | null, token: string) {
    this.authenticated = authenticated;
    this.profile = profile;
    this.token = token;
    if (this.onAuthChange) {
      this.onAuthChange(this.authenticated);
    }
  }

  init(onAuthChange: (authenticated: boolean) => void) {
    this.onAuthChange = onAuthChange;
    // Simulate onLoad: 'check-sso' which doesn't force login
    setTimeout(() => {
      console.log("Keycloak initialized (mock, check-sso)");
      // Check if a "session" exists in localStorage
      const storedProfile = localStorage.getItem('mock-keycloak-profile');
      if (storedProfile) {
        const profile = JSON.parse(storedProfile);
        const token = localStorage.getItem('mock-keycloak-token') || '';
        this.setAuthState(true, profile, token);
      } else {
        this.setAuthState(false, null, '');
      }
    }, 500);
    return Promise.resolve(this.authenticated);
  }
  
  login(isAdmin = false) {
    console.log("Redirecting to Keycloak login page (mock)");
    const userProfile: KeycloakProfile = {
      id: "uuid-user-1",
      username: "gabriel",
      firstName: "Gabriel",
      lastName: "R",
      email: "gabriel@test.com",
      emailVerified: true,
      roles: ["cliente"],
    };
    const adminProfile: KeycloakProfile = {
      id: "uuid-admin-1",
      username: "admin",
      firstName: "Admin",
      lastName: "User",
      email: "admin@test.com",
      emailVerified: true,
      roles: ["cliente", "organizador", "administrador"],
    };
    
    const profileToSet = isAdmin ? adminProfile : userProfile;
    const token = "mock-jwt-token-" + (isAdmin ? 'admin' : 'user');
    
    localStorage.setItem('mock-keycloak-profile', JSON.stringify(profileToSet));
    localStorage.setItem('mock-keycloak-token', token);

    this.setAuthState(true, profileToSet, token);
  }

  logout() {
    console.log("Redirecting to Keycloak logout page (mock)");
    localStorage.removeItem('mock-keycloak-profile');
    localStorage.removeItem('mock-keycloak-token');
    this.setAuthState(false, null, '');
  }

  hasRealmRole(role: string): boolean {
    return this.authenticated && this.profile?.roles.includes(role) || false;
  }
}

const keycloak = new KeycloakService();
export default keycloak;
