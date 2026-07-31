'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateLead, useDeleteLead, useLeads, useUpdateLead } from '@/hooks/use-leads';
import { ApiError } from '@/lib/api-client';
import type { Lead, LeadStatus } from '@worksphere/shared-types';

const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'Nou',
  CONTACTED: 'Contactat',
  QUALIFIED: 'Calificat',
  PROPOSAL: 'Ofertă trimisă',
  WON: 'Câștigat',
  LOST: 'Pierdut',
};

const STATUS_ORDER: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];

const emptyForm = {
  name: '',
  companyName: '',
  email: '',
  phone: '',
  source: '',
  status: 'NEW' as LeadStatus,
  valueCents: '',
};

export default function LeadsPage() {
  const { data: leads, isLoading } = useLeads();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingLead, setEditingLead] = React.useState<Lead | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [error, setError] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<Lead | null>(null);

  const openCreate = (status: LeadStatus) => {
    setEditingLead(null);
    setError(null);
    setForm({ ...emptyForm, status });
    setDialogOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingLead(lead);
    setError(null);
    setForm({
      name: lead.name,
      companyName: lead.companyName ?? '',
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      source: lead.source ?? '',
      status: lead.status,
      valueCents: lead.valueCents != null ? String(lead.valueCents / 100) : '',
    });
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input = {
      name: form.name,
      companyName: form.companyName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      source: form.source || undefined,
      status: form.status,
      valueCents: form.valueCents ? Math.round(Number(form.valueCents) * 100) : undefined,
    };
    try {
      if (editingLead) {
        await updateLead.mutateAsync({ id: editingLead.id, ...input });
      } else {
        await createLead.mutateAsync(input);
      }
      setDialogOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Eroare la salvarea lead-ului.');
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteLead.mutateAsync(toDelete.id);
      setToDelete(null);
    } catch {
      setToDelete(null);
    }
  };

  const leadsByStatus = STATUS_ORDER.map((status) => ({
    status,
    leads: (leads ?? []).filter((l) => l.status === status),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lead-uri</h1>
        <p className="text-sm text-muted-foreground">Urmărește potențialii clienți prin pipeline.</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Se încarcă...</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {leadsByStatus.map(({ status, leads: statusLeads }) => (
          <div key={status} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {STATUS_LABEL[status]} ({statusLeads.length})
              </h2>
              <Button variant="ghost" size="sm" onClick={() => openCreate(status)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {statusLeads.map((lead) => (
                <Card key={lead.id} className="cursor-pointer" onClick={() => openEdit(lead)}>
                  <CardContent className="space-y-1 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{lead.name}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => { e.stopPropagation(); setToDelete(lead); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {lead.companyName && (
                      <p className="text-xs text-muted-foreground">{lead.companyName}</p>
                    )}
                    {lead.valueCents != null && (
                      <Badge variant="secondary" className="text-xs">
                        {(lead.valueCents / 100).toLocaleString('ro-RO')} RON
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
              {statusLeads.length === 0 && (
                <p className="text-xs text-muted-foreground">Niciun lead.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Creare / editare lead */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setError(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Editează lead' : 'Lead nou'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nume</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Firmă</Label>
                <Input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Sursă</Label>
                <Input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder="ex. site, recomandare" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as LeadStatus }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valoare estimată (RON)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.valueCents}
                  onChange={(e) => setForm((f) => ({ ...f, valueCents: e.target.value }))}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={createLead.isPending || updateLead.isPending}>
                {createLead.isPending || updateLead.isPending ? 'Se salvează...' : 'Salvează'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ștergere lead */}
      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Șterge lead</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sigur vrei să ștergi lead-ul{' '}
            <span className="font-medium text-foreground">{toDelete?.name}</span>?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Anulează
            </Button>
            <Button variant="destructive" disabled={deleteLead.isPending} onClick={confirmDelete}>
              {deleteLead.isPending ? 'Se șterge...' : 'Șterge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
