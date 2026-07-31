'use client';

import * as React from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useClients, useCreateClient, useDeleteClient, useUpdateClient } from '@/hooks/use-clients';
import { ApiError } from '@/lib/api-client';
import type { Client } from '@worksphere/shared-types';

const emptyForm = { name: '', cui: '', email: '', phone: '', address: '' };

export default function ClientsPage() {
  const { data: clients, isLoading } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);
  const [error, setError] = React.useState<string | null>(null);

  const [toEdit, setToEdit] = React.useState<Client | null>(null);
  const [editError, setEditError] = React.useState<string | null>(null);

  const [toDelete, setToDelete] = React.useState<Client | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createClient.mutateAsync({
        name: form.name,
        cui: form.cui || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
      });
      setForm(emptyForm);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Eroare la creare.');
    }
  };

  const openEdit = (client: Client) => {
    setEditError(null);
    setForm({
      name: client.name,
      cui: client.cui ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      address: client.address ?? '',
    });
    setToEdit(client);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEdit) return;
    setEditError(null);
    try {
      await updateClient.mutateAsync({
        id: toEdit.id,
        name: form.name,
        cui: form.cui || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
      });
      setToEdit(null);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'Eroare la actualizare.');
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleteError(null);
    try {
      await deleteClient.mutateAsync(toDelete.id);
      setToDelete(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Eroare la ștergere.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clienți</h1>
          <p className="text-sm text-muted-foreground">Baza de date de clienți a companiei tale.</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => { setOpen(v); if (v) setForm(emptyForm); setError(null); }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Client nou
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Client nou</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nume</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CUI</Label>
                  <Input value={form.cui} onChange={(e) => setForm((f) => ({ ...f, cui: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Adresă</Label>
                  <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={createClient.isPending}>
                  {createClient.isPending ? 'Se salvează...' : 'Salvează'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-muted-foreground">Se încarcă...</p>}
        {!isLoading && clients?.length === 0 && (
          <p className="text-sm text-muted-foreground">Niciun client încă.</p>
        )}
        {clients?.map((client) => (
          <Card key={client.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <CardTitle className="text-base">{client.name}</CardTitle>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(client)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => { setDeleteError(null); setToDelete(client); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {client.email && <p>{client.email}</p>}
              {client.phone && <p>{client.phone}</p>}
              {client.cui && <p>CUI: {client.cui}</p>}
              <p className="mt-2 text-xs">
                {client._count?.projects ?? 0} proiecte · {client._count?.tasks ?? 0} task-uri
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Editare client */}
      <Dialog open={!!toEdit} onOpenChange={(v) => !v && setToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editează client</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nume</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CUI</Label>
                <Input value={form.cui} onChange={(e) => setForm((f) => ({ ...f, cui: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Adresă</Label>
                <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <DialogFooter>
              <Button type="submit" disabled={updateClient.isPending}>
                {updateClient.isPending ? 'Se salvează...' : 'Salvează'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ștergere client */}
      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Șterge client</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sigur vrei să ștergi clientul{' '}
            <span className="font-medium text-foreground">{toDelete?.name}</span>? Funcționează
            doar dacă nu are task-uri sau proiecte asociate.
          </p>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Anulează
            </Button>
            <Button variant="destructive" disabled={deleteClient.isPending} onClick={confirmDelete}>
              {deleteClient.isPending ? 'Se șterge...' : 'Șterge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
