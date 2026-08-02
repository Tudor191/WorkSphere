import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Lead, LeadStatus } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

export interface LeadInput {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: LeadStatus;
  valueCents?: number;
  ownerId?: string;
}

/** `companyId` în queryKey — vezi comentariul din `use-employees.ts`. */
export function useLeads() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['leads', companyId],
    queryFn: () => apiFetch<Lead[]>('/leads'),
    enabled: Boolean(companyId),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LeadInput) =>
      apiFetch<Lead>('/leads', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<LeadInput> & { id: string }) =>
      apiFetch<Lead>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/leads/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });
}
