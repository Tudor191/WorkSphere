import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

/** `companyId` în queryKey — vezi comentariul din `use-employees.ts`. */
export function useNotifications() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['notifications', companyId],
    queryFn: () => apiFetch<AppNotification[]>('/notifications'),
    refetchInterval: 30_000,
    enabled: Boolean(companyId),
  });
}

export function useUnreadNotificationsCount() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['notifications', 'unread-count', companyId],
    queryFn: () => apiFetch<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30_000,
    retry: false,
    enabled: Boolean(companyId),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useRegisterDeviceToken() {
  return useMutation({
    mutationFn: (input: { fcmToken: string; platform: string }) =>
      apiFetch<void>('/notifications/device-tokens', { method: 'POST', body: JSON.stringify(input) }),
  });
}
