'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { platformTokenStore } from '@/lib/platform-token-store';
import { ApiError } from '@/lib/api-client';
import { usePlatformAdminMe, usePlatformCompanies, useHardReset } from '@/hooks/use-platform-admin';

const CONFIRMATION_PHRASE = 'imiplacepuiul';

export default function PlatformAdminPanel() {
  const router = useRouter();
  const [hasToken] = React.useState(() => Boolean(platformTokenStore.get()));
  const { data: admin, isLoading: meLoading, isError: meError } = usePlatformAdminMe(hasToken);
  const { data: companies, isLoading: companiesLoading } = usePlatformCompanies(hasToken && !meError);
  const hardReset = useHardReset();

  const [resetOpen, setResetOpen] = React.useState(false);
  const [phrase, setPhrase] = React.useState('');
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [resetResult, setResetResult] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!hasToken || meError) {
      router.replace('/dev/login');
    }
  }, [hasToken, meError, router]);

  const logout = () => {
    platformTokenStore.set(null);
    router.push('/dev/login');
  };

  const confirmHardReset = async () => {
    setResetError(null);
    try {
      const res = await hardReset.mutateAsync(phrase);
      setResetResult(`${res.deletedCompanies} companii șterse ireversibil, cu toate datele lor.`);
      setResetOpen(false);
      setPhrase('');
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : 'Eroare la resetare.');
    }
  };

  if (!hasToken || meLoading || meError) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Se încarcă...
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-6 p-6 sm:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Panou developer</h1>
          <p className="text-sm text-muted-foreground">
            Autentificat ca {admin?.firstName} {admin?.lastName} ({admin?.email})
          </p>
        </div>
        <Button variant="ghost" onClick={logout}>
          Deconectare
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Companii înregistrate</CardTitle>
          <CardDescription>Toate firmele de pe platformă, indiferent de plan sau stare.</CardDescription>
        </CardHeader>
        <CardContent>
          {companiesLoading && <p className="text-sm text-muted-foreground">Se încarcă...</p>}
          {!companiesLoading && companies?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nicio companie înregistrată.</p>
          )}
          {!companiesLoading && companies && companies.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Nume</th>
                    <th className="py-2 pr-4 font-medium">Slug</th>
                    <th className="py-2 pr-4 font-medium">Utilizatori</th>
                    <th className="py-2 pr-4 font-medium">Angajați</th>
                    <th className="py-2 font-medium">Creată</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="py-2 pr-4">{c.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{c.slug}</td>
                      <td className="py-2 pr-4">{c.userCount}</td>
                      <td className="py-2 pr-4">{c.employeeCount}</td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString('ro-RO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Zonă periculoasă</CardTitle>
          <CardDescription>
            Șterge ireversibil TOATE companiile și toate datele lor de pe platformă (angajați, concedii,
            pontaje, documente etc.). Fără opțiune de recuperare.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {resetResult && <p className="text-sm text-success">{resetResult}</p>}
          <Button variant="destructive" onClick={() => setResetOpen(true)}>
            Șterge toate datele (hard reset)
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={resetOpen}
        onOpenChange={(open) => {
          setResetOpen(open);
          if (!open) {
            setPhrase('');
            setResetError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmă hard reset-ul</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Această acțiune șterge ireversibil toate companiile și toate datele lor. Pentru a confirma,
            scrie fraza de siguranță mai jos.
          </p>
          <div className="space-y-2">
            <Label htmlFor="phrase">Fraza de confirmare</Label>
            <Input
              id="phrase"
              autoComplete="off"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="scrie fraza de confirmare"
            />
          </div>
          {resetError && <p className="text-sm text-destructive">{resetError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              Anulează
            </Button>
            <Button
              variant="destructive"
              disabled={phrase !== CONFIRMATION_PHRASE || hardReset.isPending}
              onClick={confirmHardReset}
            >
              {hardReset.isPending ? 'Se șterge...' : 'Da, șterge absolut tot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
