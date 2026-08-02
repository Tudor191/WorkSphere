'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { platformApiFetch } from '@/lib/platform-api-client';
import { platformTokenStore } from '@/lib/platform-token-store';
import { ApiError } from '@/lib/api-client';

export default function PlatformAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await platformApiFetch<{ accessToken: string }>('/platform-admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      platformTokenStore.set(data.accessToken);
      router.push('/dev');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu ne-am putut conecta la server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Acces developer"
      description="Cont de platformă, separat de conturile companiilor — nu are acces la angajați sau concedii."
      footer="Acest cont poate șterge ireversibil toate datele de pe platformă."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Parolă</Label>
          <Input
            id="password"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? 'Se conectează...' : 'Autentificare developer'}
        </Button>
      </form>
    </AuthShell>
  );
}
