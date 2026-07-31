import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AttendanceRecord } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

/** `companyId` în queryKey — vezi comentariul din `use-employees.ts`. */
export function useMyAttendance() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['attendance', 'mine', companyId],
    queryFn: () => apiFetch<AttendanceRecord[]>('/attendance/mine'),
    enabled: Boolean(companyId),
  });
}

export function useAllAttendance() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['attendance', 'all', companyId],
    queryFn: () => apiFetch<AttendanceRecord[]>('/attendance'),
    enabled: Boolean(companyId),
  });
}

export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<AttendanceRecord>('/attendance/check-in', { method: 'POST', body: '{}' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });
}

export function useCheckOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<AttendanceRecord>('/attendance/check-out', { method: 'POST', body: '{}' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });
}
