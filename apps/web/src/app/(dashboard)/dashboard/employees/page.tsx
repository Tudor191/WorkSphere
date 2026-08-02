'use client';

import * as React from 'react';
import { Pencil, Plus, Trash2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  useCreateEmployee,
  useDeleteEmployee,
  useEmployees,
  useHardDeleteEmployee,
  useUpdateEmployeeRole,
} from '@/hooks/use-employees';
import { useRoles } from '@/hooks/use-roles';
import { useDepartments } from '@/hooks/use-departments';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError } from '@/lib/api-client';
import { ROLE_INFO, ROLE_ORDER, roleLabelRo, type Employee, type Role } from '@worksphere/shared-types';

/** Radix Select nu acceptă `value=""` pe un item — sentinelă pentru "fără departament". */
const NO_DEPARTMENT = '__none__';

function sortByHierarchy(roles: Role[] | undefined): Role[] {
  if (!roles) return [];
  return [...roles].sort((a, b) => {
    const ai = a.systemKey ? ROLE_ORDER.indexOf(a.systemKey as (typeof ROLE_ORDER)[number]) : 99;
    const bi = b.systemKey ? ROLE_ORDER.indexOf(b.systemKey as (typeof ROLE_ORDER)[number]) : 99;
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

const statusVariant: Record<string, 'success' | 'warning' | 'secondary'> = {
  ACTIVE: 'success',
  INVITED: 'warning',
  SUSPENDED: 'secondary',
};

export default function EmployeesPage() {
  const { data: employees, isLoading } = useEmployees();
  const { data: roles } = useRoles();
  const { data: departments } = useDepartments();
  const createEmployee = useCreateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const hardDeleteEmployee = useHardDeleteEmployee();
  const updateEmployeeRole = useUpdateEmployeeRole();
  const { user } = useAuth();

  const sortedRoles = React.useMemo(() => sortByHierarchy(roles), [roles]);
  const roleById = React.useMemo(() => new Map(roles?.map((r) => [r.id, r])), [roles]);

  // Ascunde implicit conturile suspendate (demise sau șterse de ele
  // însele) — altfel rămân la nesfârșit în listă, chiar și un cont
  // anonimizat ("Utilizator șters") pe care nu-l mai poți nici demite, nici
  // face nimic cu el vizual. Datele istorice rămân intacte în DB — doar
  // ascunse din vederea implicită, cu un comutator ca să fie oricând vizibile.
  const [showFormer, setShowFormer] = React.useState(false);
  const visibleEmployees = React.useMemo(
    () => employees?.filter((e) => showFormer || e.user.status !== 'SUSPENDED'),
    [employees, showFormer],
  );
  const suspendedCount = employees?.filter((e) => e.user.status === 'SUSPENDED').length ?? 0;

  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successPassword, setSuccessPassword] = React.useState<string | null>(null);
  const [toRemove, setToRemove] = React.useState<Employee | null>(null);
  const [removeError, setRemoveError] = React.useState<string | null>(null);
  const [toHardDelete, setToHardDelete] = React.useState<Employee | null>(null);
  const [hardDeleteError, setHardDeleteError] = React.useState<string | null>(null);
  const [toPromote, setToPromote] = React.useState<Employee | null>(null);
  const [promoteForm, setPromoteForm] = React.useState({
    position: '',
    roleId: '',
    departmentId: '',
  });
  const [promoteError, setPromoteError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    email: '',
    firstName: '',
    lastName: '',
    position: '',
    roleId: '',
    departmentId: '',
    hireDate: new Date().toISOString().slice(0, 10),
  });

  const resetForm = () =>
    setForm({ email: '', firstName: '', lastName: '', position: '', roleId: '', departmentId: '', hireDate: new Date().toISOString().slice(0, 10) });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await createEmployee.mutateAsync({
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        position: form.position,
        roleId: form.roleId,
        departmentId: form.departmentId || undefined,
        contractType: 'FULL_TIME',
        hireDate: form.hireDate,
      });
      setSuccessPassword(result.temporaryPassword);
      resetForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Eroare la crearea angajatului.');
    }
  };

  const confirmRemove = async () => {
    if (!toRemove) return;
    setRemoveError(null);
    try {
      await deleteEmployee.mutateAsync(toRemove.id);
      setToRemove(null);
    } catch (err) {
      setRemoveError(err instanceof ApiError ? err.message : 'Eroare la demiterea angajatului.');
    }
  };

  const confirmHardDelete = async () => {
    if (!toHardDelete) return;
    setHardDeleteError(null);
    try {
      await hardDeleteEmployee.mutateAsync(toHardDelete.id);
      setToHardDelete(null);
    } catch (err) {
      setHardDeleteError(err instanceof ApiError ? err.message : 'Eroare la ștergerea definitivă.');
    }
  };

  const openPromote = (emp: Employee) => {
    setPromoteError(null);
    setPromoteForm({
      position: emp.position,
      roleId: emp.user.roleId,
      departmentId: emp.departmentId ?? NO_DEPARTMENT,
    });
    setToPromote(emp);
  };

  const confirmPromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toPromote) return;
    setPromoteError(null);
    try {
      await updateEmployeeRole.mutateAsync({
        id: toPromote.id,
        ...promoteForm,
        departmentId: promoteForm.departmentId === NO_DEPARTMENT ? null : promoteForm.departmentId,
      });
      setToPromote(null);
    } catch (err) {
      setPromoteError(err instanceof ApiError ? err.message : 'Eroare la actualizarea angajatului.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Angajați</h1>
          <p className="text-sm text-muted-foreground">Gestionează echipa companiei tale.</p>
        </div>

        <div className="flex items-center gap-4">
          {suspendedCount > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={showFormer} onCheckedChange={setShowFormer} />
              Arată și foștii angajați ({suspendedCount})
            </label>
          )}

          <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
              setError(null);
              setSuccessPassword(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Adaugă angajat
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Angajat nou</DialogTitle>
            </DialogHeader>

            {successPassword ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Cont creat cu succes. Angajatul a primit un email cu un link ca să-și seteze singur
                  parola. Dacă nu primește emailul, îi poți comunica manual parola temporară de mai jos —
                  la prima autentificare va trebui oricum s-o schimbe:
                </p>
                <code className="block rounded-lg bg-muted px-4 py-3 text-sm">{successPassword}</code>
                <DialogFooter>
                  <Button onClick={() => setOpen(false)}>Închide</Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prenume</Label>
                    <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Nume</Label>
                    <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Funcție</Label>
                  <Input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rol</Label>
                    <Select value={form.roleId} onValueChange={(v) => setForm((f) => ({ ...f, roleId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Alege rolul" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedRoles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {roleLabelRo(r.systemKey, r.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Departament</Label>
                    <Select value={form.departmentId} onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Opțional" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments?.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Data angajării</Label>
                  <Input type="date" value={form.hireDate} onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))} required />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <DialogFooter>
                  <Button type="submit" disabled={createEmployee.isPending || !form.roleId}>
                    {createEmployee.isPending ? 'Se salvează...' : 'Salvează'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="px-6">
        <Accordion type="single" collapsible>
          <AccordionItem value="roles-faq" className="border-b-0">
            <AccordionTrigger>Ce înseamnă fiecare rol?</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {ROLE_ORDER.map((key) => (
                  <div key={key} className="flex items-start gap-3">
                    <Badge variant="secondary" className="mt-0.5 shrink-0">
                      {ROLE_INFO[key].labelRo}
                    </Badge>
                    <p>{ROLE_INFO[key].descriptionRo}</p>
                  </div>
                ))}
                <p className="pt-1 text-xs">
                  Momentan sunt 5 roluri fixe, aceleași pentru toate companiile — roluri
                  personalizate, definite de fiecare companie, urmează într-o etapă viitoare.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Nume</th>
                <th className="px-6 py-3 font-medium">Cod</th>
                <th className="px-6 py-3 font-medium">Funcție</th>
                <th className="px-6 py-3 font-medium">Rol</th>
                <th className="px-6 py-3 font-medium">Departament</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    Se încarcă...
                  </td>
                </tr>
              )}
              {!isLoading && employees?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    Niciun angajat încă. Adaugă primul angajat din butonul de mai sus.
                  </td>
                </tr>
              )}
              {!isLoading && (employees?.length ?? 0) > 0 && visibleEmployees?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    Toți angajații sunt foști angajați (conturi suspendate) — activează comutatorul de
                    mai sus ca să-i vezi.
                  </td>
                </tr>
              )}
              {visibleEmployees?.map((emp) => (
                <tr key={emp.id} className="hover:bg-accent/40">
                  <td className="px-6 py-3 font-medium">
                    {emp.user.firstName} {emp.user.lastName}
                    <p className="font-normal text-muted-foreground">{emp.user.email}</p>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{emp.employeeCode}</td>
                  <td className="px-6 py-3">{emp.position}</td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {roleLabelRo(roleById.get(emp.user.roleId)?.systemKey)}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{emp.department?.name ?? '—'}</td>
                  <td className="px-6 py-3">
                    <Badge variant={statusVariant[emp.user.status] ?? 'secondary'}>{emp.user.status}</Badge>
                  </td>
                  <td className="px-6 py-3 text-right">
                    {emp.user.status !== 'SUSPENDED' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editează rol / funcție"
                        onClick={() => openPromote(emp)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {emp.user.status !== 'SUSPENDED' && emp.userId !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Demite angajat"
                        onClick={() => {
                          setRemoveError(null);
                          setToRemove(emp);
                        }}
                      >
                        <UserX className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                    {emp.user.status === 'SUSPENDED' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Șterge definitiv"
                        onClick={() => {
                          setHardDeleteError(null);
                          setToHardDelete(emp);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!toRemove} onOpenChange={(v) => !v && setToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demite angajat</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ești sigur că vrei să-l demiți pe{' '}
            <span className="font-medium text-foreground">
              {toRemove?.user.firstName} {toRemove?.user.lastName}
            </span>
            ? Fișa HR și istoricul (pontaj, concedii) rămân, dar contul nu se va mai putea autentifica.
          </p>
          {removeError && <p className="text-sm text-destructive">{removeError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToRemove(null)}>
              Anulează
            </Button>
            <Button variant="destructive" disabled={deleteEmployee.isPending} onClick={confirmRemove}>
              {deleteEmployee.isPending ? 'Se demite...' : 'Demite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toHardDelete} onOpenChange={(v) => !v && setToHardDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Șterge definitiv contul</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Contul lui{' '}
            <span className="font-medium text-foreground">
              {toHardDelete?.user.firstName} {toHardDelete?.user.lastName}
            </span>{' '}
            va fi șters ireversibil din baza de date — fișa HR, istoricul de pontaj și cererile de
            concediu dispar complet și nu mai pot fi recuperate. Singurul motiv să faci asta e ca
            emailul <span className="font-medium text-foreground">{toHardDelete?.user.email}</span>{' '}
            să poată fi folosit la un cont nou.
          </p>
          {hardDeleteError && <p className="text-sm text-destructive">{hardDeleteError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToHardDelete(null)}>
              Anulează
            </Button>
            <Button
              variant="destructive"
              disabled={hardDeleteEmployee.isPending}
              onClick={confirmHardDelete}
            >
              {hardDeleteEmployee.isPending ? 'Se șterge...' : 'Șterge definitiv'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toPromote} onOpenChange={(v) => !v && setToPromote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editează rol / funcție — {toPromote?.user.firstName} {toPromote?.user.lastName}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={confirmPromote} className="space-y-4">
            <div className="space-y-2">
              <Label>Funcție</Label>
              <Input
                value={promoteForm.position}
                onChange={(e) => setPromoteForm((f) => ({ ...f, position: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select
                value={promoteForm.roleId}
                onValueChange={(v) => setPromoteForm((f) => ({ ...f, roleId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Alege rolul" />
                </SelectTrigger>
                <SelectContent>
                  {sortedRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {roleLabelRo(r.systemKey, r.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Departament</Label>
              <Select
                value={promoteForm.departmentId}
                onValueChange={(v) => setPromoteForm((f) => ({ ...f, departmentId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Fără departament" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPARTMENT}>Fără departament</SelectItem>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {promoteError && <p className="text-sm text-destructive">{promoteError}</p>}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setToPromote(null)}>
                Anulează
              </Button>
              <Button type="submit" disabled={updateEmployeeRole.isPending}>
                {updateEmployeeRole.isPending ? 'Se salvează...' : 'Salvează'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
