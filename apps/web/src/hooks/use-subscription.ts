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

/** Doar pentru downgrade la planul gratuit — planurile plătite trec prin `useCreateCheckout`. */
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

/** Întoarce un URL Stripe Checkout — apelantul face `window.location.href = url`. */
export function useCreateCheckout() {
  return useMutation({
    mutationFn: (input: { planSlug: string; billingCycle?: 'MONTHLY' | 'YEARLY' }) =>
      apiFetch<{ url: string }>('/billing/checkout', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

/** Întoarce un URL Stripe Billing Portal (gestionare plată/anulare) — la fel, redirect manual. */
export function useCreatePortal() {
  return useMutation({
    mutationFn: () => apiFetch<{ url: string }>('/billing/portal', { method: 'POST' }),
  });
}
