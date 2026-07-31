'use client';

import * as React from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateProduct, useDeleteProduct, useProducts, useUpdateProduct } from '@/hooks/use-products';
import { useCreateStockMovement } from '@/hooks/use-stock-movements';
import { ApiError } from '@/lib/api-client';
import type { Product, StockMovementType } from '@worksphere/shared-types';

const emptyForm = {
  name: '',
  sku: '',
  category: '',
  unitPriceCents: '',
  currency: 'RON',
  unit: 'buc',
  minStockAlert: '',
};

export default function ProductsPage() {
  const { data: products, isLoading } = useProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createMovement = useCreateStockMovement();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [error, setError] = React.useState<string | null>(null);

  const [toDelete, setToDelete] = React.useState<Product | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const [movementProduct, setMovementProduct] = React.useState<Product | null>(null);
  const [movementForm, setMovementForm] = React.useState({
    type: 'IN' as StockMovementType,
    quantity: '',
    reason: '',
  });
  const [movementError, setMovementError] = React.useState<string | null>(null);

  const openCreate = () => {
    setEditingProduct(null);
    setError(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setError(null);
    setForm({
      name: product.name,
      sku: product.sku,
      category: product.category ?? '',
      unitPriceCents: String(product.unitPriceCents / 100),
      currency: product.currency,
      unit: product.unit,
      minStockAlert: product.minStockAlert ?? '',
    });
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input = {
      name: form.name,
      sku: form.sku,
      category: form.category || undefined,
      unitPriceCents: Math.round(Number(form.unitPriceCents) * 100),
      currency: form.currency || undefined,
      unit: form.unit || undefined,
      minStockAlert: form.minStockAlert ? Number(form.minStockAlert) : undefined,
    };
    try {
      if (editingProduct) {
        await updateProduct.mutateAsync({ id: editingProduct.id, ...input });
      } else {
        await createProduct.mutateAsync(input);
      }
      setDialogOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Eroare la salvarea produsului.');
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleteError(null);
    try {
      await deleteProduct.mutateAsync(toDelete.id);
      setToDelete(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Eroare la ștergere.');
    }
  };

  const openMovement = (product: Product) => {
    setMovementError(null);
    setMovementForm({ type: 'IN', quantity: '', reason: '' });
    setMovementProduct(product);
  };

  const submitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementProduct) return;
    setMovementError(null);
    try {
      await createMovement.mutateAsync({
        productId: movementProduct.id,
        type: movementForm.type,
        quantity: Number(movementForm.quantity),
        reason: movementForm.reason || undefined,
      });
      setMovementProduct(null);
    } catch (err) {
      setMovementError(err instanceof ApiError ? err.message : 'Eroare la înregistrarea mișcării.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produse</h1>
          <p className="text-sm text-muted-foreground">Catalogul de produse și stocul curent.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Produs nou
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-muted-foreground">Se încarcă...</p>}
        {!isLoading && products?.length === 0 && (
          <p className="text-sm text-muted-foreground">Niciun produs încă.</p>
        )}
        {products?.map((product) => {
          const lowStock =
            product.minStockAlert != null && Number(product.stockQuantity) <= Number(product.minStockAlert);
          return (
            <Card key={product.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{product.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(product)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => { setDeleteError(null); setToDelete(product); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {(product.unitPriceCents / 100).toLocaleString('ro-RO')} {product.currency} / {product.unit}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant={lowStock ? 'destructive' : 'secondary'}>
                    Stoc: {product.stockQuantity} {product.unit}
                  </Badge>
                  {lowStock && <span className="text-xs text-destructive">stoc scăzut</span>}
                </div>
                <Button variant="outline" size="sm" onClick={() => openMovement(product)}>
                  <ArrowUpFromLine className="h-3.5 w-3.5" />
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                  Mișcare stoc
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Creare / editare produs */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setError(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editează produs' : 'Produs nou'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nume</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Categorie</Label>
                <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Preț unitar</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitPriceCents}
                  onChange={(e) => setForm((f) => ({ ...f, unitPriceCents: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Monedă</Label>
                <Input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Unitate</Label>
                <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prag alertă stoc scăzut (opțional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.minStockAlert}
                onChange={(e) => setForm((f) => ({ ...f, minStockAlert: e.target.value }))}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                {createProduct.isPending || updateProduct.isPending ? 'Se salvează...' : 'Salvează'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ștergere produs */}
      <Dialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Șterge produs</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sigur vrei să ștergi produsul{' '}
            <span className="font-medium text-foreground">{toDelete?.name}</span>? Funcționează
            doar dacă stocul curent e 0.
          </p>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Anulează
            </Button>
            <Button variant="destructive" disabled={deleteProduct.isPending} onClick={confirmDelete}>
              {deleteProduct.isPending ? 'Se șterge...' : 'Șterge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mișcare de stoc */}
      <Dialog open={!!movementProduct} onOpenChange={(v) => !v && setMovementProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mișcare stoc — {movementProduct?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitMovement} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tip</Label>
                <Select
                  value={movementForm.type}
                  onValueChange={(v) => setMovementForm((f) => ({ ...f, type: v as StockMovementType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Intrare</SelectItem>
                    <SelectItem value="OUT">Ieșire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cantitate</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={movementForm.quantity}
                  onChange={(e) => setMovementForm((f) => ({ ...f, quantity: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motiv (opțional)</Label>
              <Input
                value={movementForm.reason}
                onChange={(e) => setMovementForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="ex. recepție marfă, vânzare, inventar"
              />
            </div>

            {movementError && <p className="text-sm text-destructive">{movementError}</p>}

            <DialogFooter>
              <Button type="submit" disabled={createMovement.isPending}>
                {createMovement.isPending ? 'Se salvează...' : 'Salvează'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
