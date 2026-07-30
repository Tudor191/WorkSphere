import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Subscription, SubscriptionPlan } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';

interface SubscriptionResponse {
  subscription: Subscription | null;
  plans: SubscriptionPlan[];
}

export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: () => apiFetch<SubscriptionResponse>('/companies/me/subscription'),
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planSlug: string) =>
      apiFetch<Subscription>('/companies/me/subscription', {
        method: 'PATCH',
        body: JSON.stringify({ planSlug }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscription'] }),
  });
}
