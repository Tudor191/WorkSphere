import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LeaveBalance, LeaveRequest, LeaveType } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

/** `companyId` în queryKey — vezi comentariul din `use-employees.ts`. */
export function useLeaveRequests() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['leave-requests', companyId],
    queryFn: () => apiFetch<LeaveRequest[]>('/leave-requests'),
    enabled: Boolean(companyId),
  });
}

export function useMyLeaveRequests() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['leave-requests', 'mine', companyId],
    queryFn: () => apiFetch<LeaveRequest[]>('/leave-requests/mine'),
    enabled: Boolean(companyId),
  });
}

export function useMyLeaveBalances() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['leave-balances', 'mine', companyId],
    queryFn: () => apiFetch<LeaveBalance[]>('/leave-requests/balances/mine'),
    enabled: Boolean(companyId),
  });
}

export function useLeaveTypes() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['leave-types', companyId],
    queryFn: () => apiFetch<LeaveType[]>('/leave-requests/types'),
    enabled: Boolean(companyId),
  });
}

/**
 * Pentru badge-ul din sidebar — doar cei cu `leave_requests:approve` au
 * acces la acest endpoint; pentru restul, `isError` rămâne true și
 * componenta pur și simplu nu afișează nimic (vezi sidebar.tsx).
 * Reîmprospătat periodic, ca notificarea să apară fără reload manual.
 */
export function usePendingLeaveRequestsCount() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['leave-requests', 'pending-count', companyId],
    queryFn: () => apiFetch<{ count: number }>('/leave-requests/pending-count'),
    refetchInterval: 30_000,
    retry: false,
    enabled: Boolean(companyId),
  });
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { leaveTypeId: string; startDate: string; endDate: string; reason?: string }) =>
      apiFetch<LeaveRequest>('/leave-requests', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
  });
}

export function useApproveLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<LeaveRequest>(`/leave-requests/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
  });
}

export function useRejectLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
      apiFetch<LeaveRequest>(`/leave-requests/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejectionReason }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave-requests'] }),
  });
}
