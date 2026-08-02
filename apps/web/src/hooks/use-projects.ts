import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Project, ProjectStatus } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

export interface ProjectInput {
  name: string;
  description?: string;
  status?: ProjectStatus;
  startDate?: string;
  deadline?: string;
}

/** `companyId` în queryKey — vezi comentariul din `use-employees.ts`. */
export function useProjects() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['projects', companyId],
    queryFn: () => apiFetch<Project[]>('/projects'),
    enabled: Boolean(companyId),
  });
}

export function useProject(id: string | undefined) {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['projects', companyId, id],
    queryFn: () => apiFetch<Project>(`/projects/${id}`),
    enabled: Boolean(companyId) && Boolean(id),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectInput) =>
      apiFetch<Project>('/projects', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ProjectInput & { id: string }) =>
      apiFetch<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}
