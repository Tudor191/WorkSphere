import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Client } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

export interface ClientInput {
  name: string;
  cui?: string;
  email?: string;
  phone?: string;
  address?: string;
  ownerId?: string;
}

/** `companyId` în queryKey — vezi comentariul din `use-employees.ts`. */
export function useClients() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['clients', companyId],
    queryFn: () => apiFetch<Client[]>('/clients'),
    enabled: Boolean(companyId),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientInput) =>
      apiFetch<Client>('/clients', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ClientInput & { id: string }) =>
      apiFetch<Client>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/clients/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}
