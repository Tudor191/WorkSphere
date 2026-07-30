'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { registerSchema } from '@worksphere/shared-types';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError } from '@/lib/api-client';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = React.useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Date invalide');
      return;
    }

    setLoading(true);
    try {
      await register(parsed.data);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nu ne-am putut conecta la server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Creează cont companie"
      description="14 zile trial gratuit, fără card."
      footer={
        <>
          Ai deja cont?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Autentifică-te
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyName">Numele companiei</Label>
          <Input id="companyName" value={form.companyName} onChange={update('companyName')} placeholder="Acme SRL" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">Prenume</Label>
            <Input id="firstName" value={form.firstName} onChange={update('firstName')} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Nume</Label>
            <Input id="lastName" value={form.lastName} onChange={update('lastName')} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={update('email')} placeholder="nume@companie.ro" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Parolă</Label>
          <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={update('password')} required />
          <p className="text-xs text-muted-foreground">Minim 10 caractere, literă mare, literă mică și cifră.</p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? 'Se creează contul...' : 'Începe trial-ul gratuit'}
        </Button>
      </form>
    </AuthShell>
  );
}
