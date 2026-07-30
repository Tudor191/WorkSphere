'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/auth-provider';
import { useSetPassword } from '@/hooks/use-account';
import { ApiError } from '@/lib/api-client';

export default function SetPasswordPage() {
  const router = useRouter();
  const { user, isLoading, refreshProfile } = useAuth();
  const setPassword = useSetPassword();

  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    } else if (!isLoading && user && !user.mustChangePassword) {
      router.replace('/dashboard');
    }
  }, [isLoading, user, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Parolele nu coincid.');
      return;
    }
    try {
      await setPassword.mutateAsync(newPassword);
      await refreshProfile();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Eroare la salvarea parolei.');
    }
  };

  if (isLoading || !user || !user.mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Se încarcă...
      </div>
    );
  }

  return (
    <AuthShell
      title="Setează-ți o parolă"
      description="Contul tău a fost creat cu o parolă temporară, generată automat. Înainte să continui, alege o parolă proprie, pe care o poți reține."
      footer={null}
    >
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

        <Button type="submit" className="w-full" size="lg" disabled={setPassword.isPending}>
          {setPassword.isPending ? 'Se salvează...' : 'Salvează parola'}
        </Button>
      </form>
    </AuthShell>
  );
}
