'use client';

import * as React from 'react';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirmAccountDeletion } from '@/hooks/use-account';
import { ApiError } from '@/lib/api-client';

/**
 * Citim `window.location.search` direct într-un efect (nu `useSearchParams`)
 * — la fel ca `/reset-password` — ca să evităm nevoia unui boundary
 * Suspense doar pentru un query param, și ca pagina să rămână static
 * prerenderabilă. Emailul vine prefill-uit din link-ul din email (nu e un
 * secret — codul + parola sunt verificările reale), dar rămâne editabil.
 */
export default function ConfirmAccountDeletionPage() {
  const confirmDeletion = useConfirmAccountDeletion();
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('email');
    if (value) setEmail(value);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await confirmDeletion.mutateAsync({ email, code, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu ne-am putut conecta la server.');
    }
  };

  return (
    <AuthShell
      title="Șterge-ți contul acum"
      description="Contul tău a fost dezactivat de un administrator. Confirmă mai jos ca să fie șters definitiv imediat, în loc să aștepți termenul automat."
      footer={
        <>
          Nu ai cerut asta?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Înapoi la autentificare
          </Link>
        </>
      }
    >
      {done ? (
        <p className="text-sm text-muted-foreground">
          Contul a fost șters definitiv. Toate datele lui personale au fost eliminate.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email-ul contului</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Parola contului</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Codul de confirmare din email</Label>
            <Input
              id="code"
              autoComplete="off"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" variant="destructive" className="w-full" size="lg" disabled={confirmDeletion.isPending}>
            {confirmDeletion.isPending ? 'Se șterge...' : 'Da, șterge-mi contul definitiv'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
