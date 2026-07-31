import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Subscription, SubscriptionPlan } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

interface SubscriptionResponse {
  subscription: Subscription | null;
  plans: SubscriptionPlan[];
}

/** `companyId` în queryKey — vezi comentariul din `use-employees.ts`. */
export function useSubscription() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['subscription', companyId],
    queryFn: () => apiFetch<SubscriptionResponse>('/companies/me/subscription'),
    enabled: Boolean(companyId),
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
