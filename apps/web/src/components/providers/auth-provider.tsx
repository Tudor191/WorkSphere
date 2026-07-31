'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from '@worksphere/shared-types';
import { apiFetch, ApiError } from '@/lib/api-client';
import { tokenStore } from '@/lib/token-store';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  // Crește de fiecare dată când login()/register()/logout() stabilesc
  // explicit o sesiune — folosit ca să detectăm și să ignorăm rezultatul
  // ÎNTÂRZIAT al restaurării de sesiune de mai jos (vezi efectul), dacă
  // între timp s-a autentificat deja alt cont. Fără asta: dacă utilizatorul
  // are un cookie de sesiune vechi valid (ex: era logat ca Admin firma A)
  // și se înregistrează/loghează cu alt cont ÎNAINTE ca `fetch('/auth/refresh')`
  // de mai jos să se termine, răspunsul întârziat (pentru firma A) poate
  // sosi ULTIMUL și suprascrie silențios sesiunea nou-stabilită (firma B) —
  // exact bug-ul reprodus: înregistrare cont nou → ajungi înapoi pe vechea
  // companie, cu datele ei reale.
  const sessionVersionRef = React.useRef(0);

  React.useEffect(() => {
    // La încărcarea aplicației, încearcă să reînnoiască sesiunea din
    // cookie-ul httpOnly de refresh — dacă există și e valid, utilizatorul
    // rămâne logat fără să reintroducă parola.
    const versionAtStart = sessionVersionRef.current;
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          const { accessToken } = await res.json();
          if (sessionVersionRef.current !== versionAtStart) return; // sesiune stabilită între timp — ignoră
          tokenStore.set(accessToken);
          const profile = await apiFetch<AuthUser>('/auth/me');
          if (sessionVersionRef.current !== versionAtStart) return;
          setUser(profile);
        }
      } catch {
        // fără sesiune activă — rămâne neautentificat
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = React.useCallback(
    async (input: LoginInput) => {
      sessionVersionRef.current += 1;
      const data = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      tokenStore.set(data.accessToken);
      // Șterge orice date rămase în cache de la o sesiune anterioară (alt
      // utilizator, altă companie) — altfel, pentru o clipă (sau până la
      // următorul refetch), UI-ul poate afișa date cache-uite ale
      // fostului utilizator ca fiind ale celui nou-logat.
      queryClient.clear();
      setUser(data.user);
    },
    [queryClient],
  );

  const register = React.useCallback(
    async (input: RegisterInput) => {
      sessionVersionRef.current += 1;
      const data = await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      tokenStore.set(data.accessToken);
      queryClient.clear();
      setUser(data.user);
    },
    [queryClient],
  );

  const logout = React.useCallback(async () => {
    sessionVersionRef.current += 1;
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    tokenStore.set(null);
    setUser(null);
    queryClient.clear();
    router.push('/login');
  }, [router, queryClient]);

  const refreshProfile = React.useCallback(async () => {
    const profile = await apiFetch<AuthUser>('/auth/me');
    setUser(profile);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth trebuie folosit în interiorul AuthProvider');
  return ctx;
}

export { ApiError };
