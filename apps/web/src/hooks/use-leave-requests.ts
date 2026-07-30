import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LeaveBalance, LeaveRequest, LeaveType } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';

export function useLeaveRequests() {
  return useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => apiFetch<LeaveRequest[]>('/leave-requests'),
  });
}

export function useMyLeaveRequests() {
  return useQuery({
    queryKey: ['leave-requests', 'mine'],
    queryFn: () => apiFetch<LeaveRequest[]>('/leave-requests/mine'),
  });
}

export function useMyLeaveBalances() {
  return useQuery({
    queryKey: ['leave-balances', 'mine'],
    queryFn: () => apiFetch<LeaveBalance[]>('/leave-requests/balances/mine'),
  });
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave-types'],
    queryFn: () => apiFetch<LeaveType[]>('/leave-requests/types'),
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
