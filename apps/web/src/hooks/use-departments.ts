import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Department } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

/** `companyId` în queryKey — vezi comentariul din `use-employees.ts`. */
export function useDepartments() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['departments', companyId],
    queryFn: () => apiFetch<Department[]>('/departments'),
    enabled: Boolean(companyId),
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      apiFetch<Department>('/departments', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });
}
