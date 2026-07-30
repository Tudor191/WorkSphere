'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCompany, useUpdateCompany } from '@/hooks/use-company';
import { ApiError } from '@/lib/api-client';

export default function SettingsPage() {
  const { data: company, isLoading } = useCompany();
  const updateCompany = useUpdateCompany();
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (company) {
      setForm({
        name: company.name,
        cui: company.cui ?? '',
        address: company.address ?? '',
        email: company.email ?? '',
        phone: company.phone ?? '',
        workingHoursStart: company.workingHoursStart,
        workingHoursEnd: company.workingHoursEnd,
      });
    }
  }, [company]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await updateCompany.mutateAsync(form);
      setMessage('Setări salvate.');
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Eroare la salvare.');
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Se încarcă...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Setări companie</h1>
        <p className="text-sm text-muted-foreground">Date fiscale, contact și program de lucru.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informații generale</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nume companie</Label>
              <Input value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CUI</Label>
                <Input value={form.cui ?? ''} onChange={(e) => setForm((f) => ({ ...f, cui: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={form.phone ?? ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Adresă</Label>
              <Input value={form.address ?? ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email ?? ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Program — start</Label>
                <Input
                  value={form.workingHoursStart ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, workingHoursStart: e.target.value }))}
                  placeholder="09:00"
                />
              </div>
              <div className="space-y-2">
                <Label>Program — sfârșit</Label>
                <Input
                  value={form.workingHoursEnd ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, workingHoursEnd: e.target.value }))}
                  placeholder="18:00"
                />
              </div>
            </div>

            {message && <p className="text-sm text-muted-foreground">{message}</p>}

            <Button type="submit" disabled={updateCompany.isPending}>
              {updateCompany.isPending ? 'Se salvează...' : 'Salvează modificările'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
