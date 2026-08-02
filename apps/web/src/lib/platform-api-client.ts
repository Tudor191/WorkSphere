import { platformTokenStore } from './platform-token-store';
import { ApiError } from './api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * Wrapper minimal peste `fetch` pentru rutele `/platform-admin/*` — separat
 * de `apiFetch` (auth-ul de companie): nu trimite cookie-uri, nu încearcă
 * reînnoire silențioasă la 401 (nu există refresh token pentru acest cont),
 * doar propagă eroarea ca sesiunea să fie tratată explicit de UI.
 */
export async function platformApiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = platformTokenStore.get();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(response.status, body);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
