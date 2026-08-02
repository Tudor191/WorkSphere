'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  useApproveLeaveRequest,
  useCreateLeaveRequest,
  useLeaveRequests,
  useLeaveTypes,
  useMyLeaveBalances,
  useMyLeaveRequests,
  usePendingLeaveRequestsCount,
  useRejectLeaveRequest,
} from '@/hooks/use-leave-requests';
import { ApiError } from '@/lib/api-client';

const statusVariant: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  APPROVED: 'success',
  PENDING: 'warning',
  REJECTED: 'destructive',
  CANCELED: 'secondary',
};

const statusLabel: Record<string, string> = {
  APPROVED: 'Aprobată',
  PENDING: 'În așteptare',
  REJECTED: 'Respinsă',
  CANCELED: 'Anulată',
};

export default function LeaveRequestsPage() {
  const { data: balances } = useMyLeaveBalances();
  const { data: leaveTypes } = useLeaveTypes();
  const { data: myRequests } = useMyLeaveRequests();
  const { data: allRequests, isError: allRequestsForbidden } = useLeaveRequests();
  // dacă cererea asta eșuează (403), nu ai voie să aprobi — ascundem
  // butoanele Aprobă/Respinge în loc să le lăsăm să eșueze silențios la clic.
  const { isError: cannotApprove } = usePendingLeaveRequestsCount();
  const createRequest = useCreateLeaveRequest();
  const approveRequest = useApproveLeaveRequest();
  const rejectRequest = useRejectLeaveRequest();

  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });

  const onApprove = async (id: string) => {
    setActionError(null);
    try {
      await approveRequest.mutateAsync(id);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Eroare la aprobarea cererii.');
    }
  };

  const onReject = async (id: string) => {
    const reason = window.prompt('Motivul respingerii:');
    if (!reason) return;
    setActionError(null);
    try {
      await rejectRequest.mutateAsync({ id, rejectionReason: reason });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Eroare la respingerea cererii.');
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createRequest.mutateAsync({ ...form, reason: form.reason || undefined });
      setForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Eroare la creare.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Concedii</h1>
          <p className="text-sm text-muted-foreground">Cereri, aprobări și sold de zile disponibile.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Cerere nouă
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cerere de concediu</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Tip concediu</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                  value={form.leaveTypeId}
                  onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
                  required
                >
                  <option value="" disabled>
                    Alege tipul
                  </option>
                  {leaveTypes?.map((lt) => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data început</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Data sfârșit</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Motiv (opțional)</Label>
                <Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="submit" disabled={createRequest.isPending}>
                  {createRequest.isPending ? 'Se trimite...' : 'Trimite cererea'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {balances?.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">{b.leaveType.name}</p>
              <p className="mt-2 text-2xl font-semibold">
                {(Number(b.totalDays) - Number(b.usedDays)).toFixed(0)}{' '}
                <span className="text-sm font-normal text-muted-foreground">/ {b.totalDays} zile rămase</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cererile mele</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestsTable requests={myRequests} />
        </CardContent>
      </Card>

      {!allRequestsForbidden && allRequests && (
        <Card>
          <CardHeader>
            <CardTitle>Toate cererile companiei</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
            <RequestsTable
              requests={allRequests}
              showEmployee
              onApprove={cannotApprove ? undefined : onApprove}
              onReject={cannotApprove ? undefined : onReject}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RequestsTable({
  requests,
  showEmployee,
  onApprove,
  onReject,
}: {
  requests?: ReturnType<typeof useMyLeaveRequests>['data'];
  showEmployee?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  if (!requests || requests.length === 0) {
    return <p className="text-sm text-muted-foreground">Nicio cerere încă.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b border-border">
            {showEmployee && <th className="py-2 pr-4 font-medium">Angajat</th>}
            <th className="py-2 pr-4 font-medium">Tip</th>
            <th className="py-2 pr-4 font-medium">Perioadă</th>
            <th className="py-2 pr-4 font-medium">Zile</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            {(onApprove || onReject) && <th className="py-2 pr-4 font-medium">Acțiuni</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {requests.map((req) => (
            <tr key={req.id}>
              {showEmployee && (
                <td className="py-2 pr-4">
                  {req.employee?.user.firstName} {req.employee?.user.lastName}
                </td>
              )}
              <td className="py-2 pr-4">{req.leaveType.name}</td>
              <td className="py-2 pr-4 text-muted-foreground">
                {new Date(req.startDate).toLocaleDateString('ro-RO')} – {new Date(req.endDate).toLocaleDateString('ro-RO')}
              </td>
              <td className="py-2 pr-4">{req.daysCount}</td>
              <td className="py-2 pr-4">
                <Badge variant={statusVariant[req.status]}>{statusLabel[req.status]}</Badge>
              </td>
              {(onApprove || onReject) && (
                <td className="py-2 pr-4">
                  {req.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => onApprove?.(req.id)}>
                        Aprobă
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onReject?.(req.id)}>
                        Respinge
                      </Button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
