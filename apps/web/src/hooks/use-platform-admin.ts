import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApiFetch } from '@/lib/platform-api-client';

export interface PlatformAdminProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface PlatformCompanySummary {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  userCount: number;
  employeeCount: number;
}

export function usePlatformAdminMe(enabled: boolean) {
  return useQuery({
    queryKey: ['platform-admin', 'me'],
    queryFn: () => platformApiFetch<PlatformAdminProfile>('/platform-admin/me'),
    enabled,
    retry: false,
  });
}

export function usePlatformCompanies(enabled: boolean) {
  return useQuery({
    queryKey: ['platform-admin', 'companies'],
    queryFn: () => platformApiFetch<PlatformCompanySummary[]>('/platform-admin/companies'),
    enabled,
    retry: false,
  });
}

export function useHardReset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (confirmationPhrase: string) =>
      platformApiFetch<{ deletedCompanies: number }>('/platform-admin/hard-reset', {
        method: 'POST',
        body: JSON.stringify({ confirmationPhrase }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-admin', 'companies'] }),
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (companyId: string) =>
      platformApiFetch<{ deletedCompanyId: string; deletedCompanyName: string }>(
        `/platform-admin/companies/${companyId}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-admin', 'companies'] }),
  });
}
