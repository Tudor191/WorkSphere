import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Product } from '@worksphere/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';

export interface ProductInput {
  name: string;
  sku: string;
  barcode?: string;
  qrCode?: string;
  category?: string;
  unitPriceCents: number;
  currency?: string;
  unit?: string;
  minStockAlert?: number;
}

/** `companyId` în queryKey — vezi comentariul din `use-employees.ts`. */
export function useProducts() {
  const { user } = useAuth();
  const companyId = user?.companyId;
  return useQuery({
    queryKey: ['products', companyId],
    queryFn: () => apiFetch<Product[]>('/products'),
    enabled: Boolean(companyId),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductInput) =>
      apiFetch<Product>('/products', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<ProductInput> & { id: string }) =>
      apiFetch<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}
