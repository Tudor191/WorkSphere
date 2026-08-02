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
import {
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
  useUpdateDepartment,
} from '@/hooks/use-departments';
import { ApiError } from '@/lib/api-client';
import type { Department } from '@worksphere/shared-types';

export default function DepartmentsPage() {
  const { data: departments, isLoading } = useDepartments();
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();

  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const [toEdit, setToEdit] = React.useState<Department | null>(null);
  const [editForm, setEditForm] = React.useState({ name: '', description: '' });
  const [editError, setEditError] = React.useState<string | null>(null);

  const [toDelete, setToDelete] = React.useState<Department | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createDepartment.mutateAsync({ name, description: description || undefined });
      setName('');
      setDescription('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Eroare la creare.');
    }
  };

  const openEdit = (dept: Department) => {
    setEditError(null);
    setEditForm({ name: dept.name, description: dept.description ?? '' });
    setToEdit(dept);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEdit) return;
    setEditError(null);
    try {
      await updateDepartment.mutateAsync({
        id: toEdit.id,
        name: editForm.name,
        description: editForm.description || undefined,
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
      await deleteDepartment.mutateAsync(toDelete.id);
      setToDelete(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Eroare la ștergere.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Departamente</h1>
          <p className="text-sm text-muted-foreground">Organizează echipa pe departamente.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Departament nou
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Departament nou</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nume</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Descriere</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={createDepartment.isPending}>
                  {createDepartment.isPending ? 'Se salvează...' : 'Salvează'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-muted-foreground">Se încarcă...</p>}
        {!isLoading && departments?.length === 0 && (
          <p className="text-sm text-muted-foreground">Niciun departament încă.</p>
        )}
        {departments?.map((dept) => (
          <Card key={dept.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <CardTitle className="text-base">{dept.name}</CardTitle>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(dept)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setDeleteError(null);
                    setToDelete(dept);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{dept.description || 'Fără descriere'}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {dept._count?.employees ?? 0} angajați · {dept._count?.subDepartments ?? 0} sub-departamente
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Editare departament */}
      <Dialog open={!!toEdit} onOpenChange={(v) => !v && setToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editează departament</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nume</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Descriere</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <DialogFooter>
              <Button type="submit" disabled={updateDepartment.isPending}>
                {updateDepartment.isPending ? 'Se salvează...' : 'Salvează'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ștergere departament */}
      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Șterge departament</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sigur vrei să ștergi departamentul{' '}
            <span className="font-medium text-foreground">{toDelete?.name}</span>? Funcționează
            doar dacă nu are angajați sau sub-departamente asociate.
          </p>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Anulează
            </Button>
            <Button variant="destructive" disabled={deleteDepartment.isPending} onClick={confirmDelete}>
              {deleteDepartment.isPending ? 'Se șterge...' : 'Șterge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
