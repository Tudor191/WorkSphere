import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StockMovement, StockMovementType } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

export interface StockMovementInput {
  productId: string;
  type: StockMovementType;
  quantity: number;
  reason?: string;
}

/** `companyId` (+ `productId` opțional) în queryKey — vezi comentariul din `use-employees.ts`. */
export function useStockMovements(productId?: string) {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['stock-movements', companyId, productId ?? null],
    queryFn: () =>
      apiFetch<StockMovement[]>(
        productId ? `/stock-movements?productId=${productId}` : '/stock-movements',
      ),
    enabled: Boolean(companyId),
  });
}

export function useCreateStockMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StockMovementInput) =>
      apiFetch<StockMovement>('/stock-movements', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
