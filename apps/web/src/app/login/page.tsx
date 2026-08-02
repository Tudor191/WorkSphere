'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginSchema } from '@worksphere/shared-types';
import { AuthShell } from '@/components/auth-shell';
import { GoogleAuthButton } from '@/components/google-auth-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [sessionReplacedNotice, setSessionReplacedNotice] = React.useState(false);

  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('session') === 'replaced') {
      setSessionReplacedNotice(true);
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Date invalide');
      return;
    }

    setLoading(true);
    try {
      await login(parsed.data);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu ne-am putut conecta la server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Autentificare"
      description="Intră în contul companiei tale."
      footer={
        <>
          Nu ai cont?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Creează unul gratuit
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {sessionReplacedNotice && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Ai fost deconectat pentru că într-o altă filă sau fereastră a browserului
            te-ai autentificat cu alt cont. Autentifică-te din nou.
          </p>
        )}
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
        <div className="space-y-2">
          <Label htmlFor="password">Parolă</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? 'Se conectează...' : 'Autentificare'}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">sau</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <GoogleAuthButton label="Continuă cu Google" />
    </AuthShell>
  );
}
