import keycloak from './keycloakService';
import type { RecommendationProfile, RecommendedEventScore } from '../types';

const BASE_URL = import.meta.env.VITE_RECOMMENDATIONS_API_URL || 'http://localhost:5278/api';

type Json = any;

async function request<T = Json>(path: string): Promise<T | null> {
  try {
    await keycloak.ensureTokenValid(30);
  } catch (err) {
    // ignore refresh errors; request may still succeed without auth
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  const token = keycloak.getToken();
  if (token) {
    headers.append('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, { headers, method: 'GET' });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Recommendations API error ${response.status}: ${text}`);
  }
  const body = await response.text();
  return body ? (JSON.parse(body) as T) : null;
}

async function getProfile(userId: string): Promise<RecommendationProfile | null> {
  if (!userId) return null;
  const profile = await request<RecommendationProfile>(`/recommendations/${encodeURIComponent(userId)}`);
  return profile;
}

async function getTopEvents(userId: string, take = 3): Promise<RecommendedEventScore[]> {
  if (!userId) return [];
  const payload = await request<{ items?: RecommendedEventScore[] }>(`/recommendations/${encodeURIComponent(userId)}/top?take=${take}`);
  if (!payload) return [];
  return payload.items ?? [];
}

const recommendationsApi = {
  getProfile,
  getTopEvents,
};

export default recommendationsApi;
