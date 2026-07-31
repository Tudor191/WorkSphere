import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Employee } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

export interface CreateEmployeeInput {
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  departmentId?: string;
  position: string;
  contractType: string;
  hireDate: string;
  annualLeaveDays?: number;
}

/**
 * `companyId` face parte din queryKey ca strat suplimentar de izolare —
 * `queryClient.clear()` la login/logout (vezi `auth-provider.tsx`) acoperă
 * schimbarea de cont în cazul normal, dar un query key comun tuturor
 * companiilor tot lasă loc unei clipe de date greșite dacă o cerere veche,
 * pornită sub o altă sesiune, se rezolvă mai târziu decât ar trebui. Cu
 * `companyId` în cheie, un asemenea răspuns întârziat ar scrie sub cu totul
 * altă cheie de cache, nu peste datele companiei curente.
 */
export function useEmployees() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['employees', companyId],
    queryFn: () => apiFetch<Employee[]>('/employees'),
    enabled: Boolean(companyId),
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) =>
      apiFetch<{ employee: Employee; temporaryPassword: string }>('/employees', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/employees/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}

/** Ștergere definitivă (ireversibilă) — doar pentru conturi deja demise. */
export function useHardDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/employees/${id}/permanent`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export interface PromoteEmployeeInput {
  id: string;
  position: string;
  roleId: string;
  departmentId?: string | null;
}

/** Schimbă funcția și/sau rolul unui angajat existent — folosit la promovare. */
export function useUpdateEmployeeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: PromoteEmployeeInput) =>
      apiFetch<Employee>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });
}
