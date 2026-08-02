'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCompany,
  useDeleteCurrentCompany,
  useExportCompanyData,
  useResetAttendanceData,
  useResetLeaveData,
  useUpdateCompany,
} from '@/hooks/use-company';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

type ResetCategory = 'leave' | 'attendance' | null;

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { data: company, isLoading } = useCompany();
  const updateCompany = useUpdateCompany();
  const resetLeaveData = useResetLeaveData();
  const resetAttendanceData = useResetAttendanceData();
  const exportData = useExportCompanyData();
  const deleteCompany = useDeleteCurrentCompany();
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [message, setMessage] = React.useState<string | null>(null);
  const [resetCategory, setResetCategory] = React.useState<ResetCategory>(null);
  const [resetResult, setResetResult] = React.useState<string | null>(null);
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [showDeleteCompany, setShowDeleteCompany] = React.useState(false);
  const [deleteCompanyPassword, setDeleteCompanyPassword] = React.useState('');
  const [deleteCompanyError, setDeleteCompanyError] = React.useState<string | null>(null);
  const [deleteCompanySuccess, setDeleteCompanySuccess] = React.useState<string | null>(null);

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

  const confirmReset = async () => {
    setResetError(null);
    setResetResult(null);
    try {
      if (resetCategory === 'leave') {
        const res = await resetLeaveData.mutateAsync();
        setResetResult(
          `${res.deletedRequests} cereri de concediu șterse, ${res.resetBalances} solduri resetate la 0 zile consumate.`,
        );
      } else if (resetCategory === 'attendance') {
        const res = await resetAttendanceData.mutateAsync();
        setResetResult(`${res.deletedRecords} înregistrări de pontaj șterse.`);
      }
      setResetCategory(null);
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : 'Eroare la resetare.');
    }
  };

  const resetPending = resetLeaveData.isPending || resetAttendanceData.isPending;

  const onExportData = async () => {
    setExportError(null);
    try {
      const data = await exportData.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `worksphere-export-${company?.slug ?? 'companie'}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Eroare la exportul datelor.');
    }
  };

  const onConfirmDeleteCompany = async () => {
    setDeleteCompanyError(null);
    try {
      await deleteCompany.mutateAsync({ password: deleteCompanyPassword || undefined });
      setDeleteCompanySuccess('Compania și toate datele ei au fost șterse definitiv. Te deconectăm...');
      setTimeout(() => logout(), 2000);
    } catch (err) {
      setDeleteCompanyError(err instanceof ApiError ? err.message : 'Eroare la ștergerea companiei.');
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

      <Card>
        <CardHeader>
          <CardTitle>Datele tale (GDPR)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Descarcă o copie completă, în format JSON, a tuturor datelor companiei (angajați,
            concedii, pontaje, proiecte, chat, documente etc.) — dreptul la portabilitatea datelor.
          </p>
          {exportError && <p className="text-sm text-destructive">{exportError}</p>}
          <Button variant="outline" onClick={onExportData} disabled={exportData.isPending}>
            {exportData.isPending ? 'Se pregătește exportul...' : 'Exportă datele companiei'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Zonă periculoasă</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Resetează datele de test dintr-o categorie, fără să afectezi restul companiei. Fiecare
            categorie are propriul buton — nu există un reset general „la tot&rdquo;.
          </p>

          {resetResult && <p className="text-sm text-success">{resetResult}</p>}

          <div className="flex flex-wrap gap-3">
            <Button variant="destructive" onClick={() => setResetCategory('leave')}>
              Resetează concediile
            </Button>
            <Button variant="destructive" onClick={() => setResetCategory('attendance')}>
              Resetează pontajele
            </Button>
          </div>

          <div className="border-t border-destructive/20 pt-4">
            <p className="mb-3 text-sm text-muted-foreground">
              Ștergerea companiei este definitivă și îi afectează pe TOȚI colegii — toate conturile,
              angajații și datele lor dispar ireversibil, imediat (dreptul la ștergere).
            </p>
            <Button variant="destructive" onClick={() => setShowDeleteCompany(true)}>
              Șterge definitiv compania
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!resetCategory} onOpenChange={(v) => !v && setResetCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmă resetarea</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {resetCategory === 'leave' &&
              'Toate cererile de concediu vor fi șterse ireversibil, iar soldurile de concediu revin la 0 zile consumate. Angajații și departamentele NU sunt afectate.'}
            {resetCategory === 'attendance' &&
              'Toate înregistrările de pontaj (check-in/check-out) vor fi șterse ireversibil. Angajații și departamentele NU sunt afectate.'}
          </p>
          {resetError && <p className="text-sm text-destructive">{resetError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetCategory(null)}>
              Anulează
            </Button>
            <Button variant="destructive" disabled={resetPending} onClick={confirmReset}>
              {resetPending ? 'Se resetează...' : 'Da, resetează'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDeleteCompany}
        onOpenChange={(open) => {
          if (!open && !deleteCompanySuccess) {
            setShowDeleteCompany(false);
            setDeleteCompanyPassword('');
            setDeleteCompanyError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ștergi definitiv compania?</DialogTitle>
          </DialogHeader>

          {deleteCompanySuccess ? (
            <p className="text-sm text-success">{deleteCompanySuccess}</p>
          ) : user?.hasPassword ? (
            <>
              <p className="text-sm text-muted-foreground">
                Această acțiune este ireversibilă și îi deconectează pe toți colegii. Introdu parola
                contului tău ca să confirmi.
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete-company-password">Parola curentă</Label>
                <Input
                  id="delete-company-password"
                  type="password"
                  autoComplete="off"
                  value={deleteCompanyPassword}
                  onChange={(e) => setDeleteCompanyPassword(e.target.value)}
                  autoFocus
                />
              </div>
              {deleteCompanyError && <p className="text-sm text-destructive">{deleteCompanyError}</p>}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Ești sigur că vrei să ștergi definitiv compania? Această acțiune este ireversibilă și
                îi deconectează pe toți colegii.
              </p>
              {deleteCompanyError && <p className="text-sm text-destructive">{deleteCompanyError}</p>}
            </>
          )}

          {!deleteCompanySuccess && (
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDeleteCompany(false);
                  setDeleteCompanyPassword('');
                  setDeleteCompanyError(null);
                }}
              >
                Anulează
              </Button>
              <Button
                variant="destructive"
                disabled={(user?.hasPassword && !deleteCompanyPassword) || deleteCompany.isPending}
                onClick={onConfirmDeleteCompany}
              >
                {deleteCompany.isPending ? 'Se șterge...' : 'Da, șterge definitiv compania'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
