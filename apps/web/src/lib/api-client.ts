import { tokenStore } from './token-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(typeof body === 'object' && body && 'message' in body ? String((body as { message: unknown }).message) : 'Eroare API');
  }
}

async function rawFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = tokenStore.get();
  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

/**
 * Wrapper peste `fetch` care atașează automat access token-ul curent și,
 * la un 401 (token expirat), încearcă o singură dată reînnoirea silențioasă
 * via `/auth/refresh` (cookie httpOnly) înainte de a ceda — evită să
 * deconecteze utilizatorul doar pentru că access token-ul (valabil 15 min)
 * a expirat în timp ce sesiunea (refresh token, 30 zile) e încă validă.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response = await rawFetch(path, options);

  if (response.status === 401 && tokenStore.get()) {
    const refreshed = await rawFetch('/auth/refresh', { method: 'POST' });
    if (refreshed.ok) {
      const { accessToken } = (await refreshed.json()) as { accessToken: string };
      tokenStore.set(accessToken);
      response = await rawFetch(path, options);
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(response.status, body);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
