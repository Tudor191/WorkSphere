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
