'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from '@worksphere/shared-types';
import { apiFetch, ApiError } from '@/lib/api-client';
import { tokenStore } from '@/lib/token-store';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // La încărcarea aplicației, încearcă să reînnoiască sesiunea din
    // cookie-ul httpOnly de refresh — dacă există și e valid, utilizatorul
    // rămâne logat fără să reintroducă parola.
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          const { accessToken } = await res.json();
          tokenStore.set(accessToken);
          const profile = await apiFetch<AuthUser>('/auth/me');
          setUser(profile);
        }
      } catch {
        // fără sesiune activă — rămâne neautentificat
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = React.useCallback(async (input: LoginInput) => {
    const data = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    tokenStore.set(data.accessToken);
    setUser(data.user);
  }, []);

  const register = React.useCallback(async (input: RegisterInput) => {
    const data = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    tokenStore.set(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = React.useCallback(async () => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    tokenStore.set(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth trebuie folosit în interiorul AuthProvider');
  return ctx;
}

export { ApiError };
