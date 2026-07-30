import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Employee } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';

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

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: () => apiFetch<Employee[]>('/employees'),
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
