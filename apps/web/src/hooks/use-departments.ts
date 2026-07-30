import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Department } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: () => apiFetch<Department[]>('/departments'),
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
