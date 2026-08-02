'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useResetPassword } from '@/hooks/use-account';
import { ApiError } from '@/lib/api-client';

/**
 * Citim `window.location.search` direct într-un efect (nu `useSearchParams`)
 * — la fel ca `/register/google` — ca să evităm nevoia unui boundary
 * Suspense doar pentru un query param, și ca pagina să rămână static
 * prerenderabilă.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const resetPassword = useResetPassword();
  const [token, setToken] = React.useState<string | null>(null);
  const [tokenMissing, setTokenMissing] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('token');
    if (!value) {
      setTokenMissing(true);
      return;
    }
    setToken(value);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) return;
    if (newPassword !== confirmPassword) {
      setError('Parolele nu coincid.');
      return;
    }

    try {
      await resetPassword.mutateAsync({ token, newPassword });
      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu ne-am putut conecta la server.');
    }
  };

  return (
    <AuthShell
      title="Alege o parolă"
      description="Această parolă va fi folosită de acum încolo pentru autentificare — valabil atât la resetare, cât și la prima setare a parolei."
      footer={
        <>
          Linkul nu funcționează?{' '}
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            Cere unul nou
          </Link>
        </>
      }
    >
      {tokenMissing ? (
        <p className="text-sm text-destructive">
          Link invalid — cere un nou link de resetare din pagina „Ai uitat parola?”.
        </p>
      ) : done ? (
        <p className="text-sm text-muted-foreground">
          Parola a fost schimbată. Te redirecționăm spre autentificare...
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Parolă nouă</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Minim 10 caractere, literă mare, literă mică și cifră.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmă parola nouă</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" size="lg" disabled={resetPassword.isPending || !token}>
            {resetPassword.isPending ? 'Se salvează...' : 'Salvează parola nouă'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
