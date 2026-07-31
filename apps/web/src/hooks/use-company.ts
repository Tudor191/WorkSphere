import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Company } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

/** `companyId` în queryKey — vezi comentariul din `use-employees.ts`. */
export function useCompany() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['company', companyId],
    queryFn: () => apiFetch<Company>('/companies/me'),
    enabled: Boolean(companyId),
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
