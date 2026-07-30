'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
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
import { useCreateDepartment, useDepartments } from '@/hooks/use-departments';
import { ApiError } from '@/lib/api-client';

export default function DepartmentsPage() {
  const { data: departments, isLoading } = useDepartments();
  const createDepartment = useCreateDepartment();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

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
            <CardHeader>
              <CardTitle className="text-base">{dept.name}</CardTitle>
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
    </div>
  );
}
