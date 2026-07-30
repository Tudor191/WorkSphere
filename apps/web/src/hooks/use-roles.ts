import { useQuery } from '@tanstack/react-query';
import type { Role } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => apiFetch<Role[]>('/roles'),
  });
}
