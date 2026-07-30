import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AttendanceRecord } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';

export function useMyAttendance() {
  return useQuery({
    queryKey: ['attendance', 'mine'],
    queryFn: () => apiFetch<AttendanceRecord[]>('/attendance/mine'),
  });
}

export function useAllAttendance() {
  return useQuery({
    queryKey: ['attendance', 'all'],
    queryFn: () => apiFetch<AttendanceRecord[]>('/attendance'),
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
