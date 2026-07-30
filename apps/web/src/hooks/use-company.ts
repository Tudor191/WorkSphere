import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Company } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';

export function useCompany() {
  return useQuery({
    queryKey: ['company'],
    queryFn: () => apiFetch<Company>('/companies/me'),
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Company>) =>
      apiFetch<Company>('/companies/me', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company'] }),
  });
}

export function useResetLeaveData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ deletedRequests: number; resetBalances: number }>('/companies/me/reset/leave-requests', {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
  });
}

export function useResetAttendanceData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ deletedRecords: number }>('/companies/me/reset/attendance', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });
}
