'use client';

import * as React from 'react';
import Link from 'next/link';
import { forgotPasswordSchema } from '@worksphere/shared-types';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForgotPassword } from '@/hooks/use-account';

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Email invalid');
      return;
    }

    try {
      await forgotPassword.mutateAsync(parsed.data);
    } catch {
      // Intenționat: nu deosebim o eroare reală de "emailul nu are cont" —
      // API-ul răspunde mereu la fel, ca să nu devină un oracol pentru ce
      // adrese sunt înregistrate pe platformă.
    } finally {
      setSent(true);
    }
  };

  return (
    <AuthShell
      title={sent ? 'Email trimis' : 'Ai uitat parola?'}
      description={sent ? undefined : 'Introdu emailul contului tău — dacă există, primești un link de resetare.'}
      footer={
        <>
          Ți-ai amintit parola?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Autentifică-te
          </Link>
        </>
      }
    >
      {sent ? (
        <p className="text-sm text-muted-foreground">
          Dacă există un cont cu emailul <strong>{email}</strong>, ai primit un link de resetare a
          parolei. Verifică și folderul de spam.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nume@companie.ro"
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" size="lg" disabled={forgotPassword.isPending}>
            {forgotPassword.isPending ? 'Se trimite...' : 'Trimite link de resetare'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
