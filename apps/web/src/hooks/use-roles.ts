import { useQuery } from '@tanstack/react-query';
import type { Role } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

/** `companyId` în queryKey — vezi comentariul din `use-employees.ts`. */
export function useRoles() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['roles', companyId],
    queryFn: () => apiFetch<Role[]>('/roles'),
    enabled: Boolean(companyId),
  });
}
