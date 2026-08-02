'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError } from '@/lib/api-client';

/**
 * A doua (și ultima) oprire a înregistrării prin Google — ajuns aici după
 * redirectul de la `/api/auth/google/callback` cu un token temporar în URL
 * (`?token=`). Citim `window.location.search` direct într-un efect (nu
 * `useSearchParams`) — la fel ca pagina de login (`session=replaced`) —
 * ca să evităm nevoia unui boundary Suspense doar pentru un query param.
 */
export default function GoogleCompleteRegistrationPage() {
  const router = useRouter();
  const { completeGoogleRegistration } = useAuth();
  const [token, setToken] = React.useState<string | null>(null);
  const [tokenMissing, setTokenMissing] = React.useState(false);
  const [companyName, setCompanyName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

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
    if (companyName.trim().length < 2) {
      setError('Numele companiei e prea scurt.');
      return;
    }

    setLoading(true);
    try {
      await completeGoogleRegistration({ token, companyName });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu ne-am putut conecta la server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Încă un pas"
      description="Contul tău Google a fost verificat — mai spune-ne numele companiei."
      footer={
        <>
          Nu tu ai pornit înregistrarea asta?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Începe din nou
          </Link>
        </>
      }
    >
      {tokenMissing ? (
        <p className="text-sm text-destructive">
          Link invalid sau expirat — reia procesul din pagina de înregistrare.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Numele companiei</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme SRL"
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" size="lg" disabled={loading || !token}>
            {loading ? 'Se creează contul...' : 'Creează compania'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
