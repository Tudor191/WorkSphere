import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(productId?: string) {
    return this.prisma.tenantScoped.stockMovement.findMany({
      where: {
        companyId: TenantContext.requireCompanyId(),
        ...(productId ? { productId } : {}),
      },
      include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Tranzacție atomică (`runInTenantTransaction`, ca la aprobarea de concediu):
   * stocul curent al produsului trebuie să rămână mereu în sincron cu suma
   * mișcărilor înregistrate — nu poate exista o mișcare fără actualizarea
   * stocului, sau invers.
   */
  create(dto: CreateStockMovementDto, performedById: string) {
    return this.prisma.runInTenantTransaction(async (tx) => {
      const companyId = TenantContext.requireCompanyId();
      const product = await tx.product.findFirst({
        where: { id: dto.productId, companyId },
      });
      if (!product) throw new NotFoundException('Produs inexistent.');

      const delta = dto.type === 'IN' ? dto.quantity : -dto.quantity;
      const newQuantity = Number(product.stockQuantity) + delta;
      if (newQuantity < 0) {
        throw new ConflictException(
          `Stoc insuficient — disponibil ${product.stockQuantity} ${product.unit}, se încearcă scoaterea a ${dto.quantity}.`,
        );
      }

      await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: newQuantity },
      });

      return tx.stockMovement.create({
        data: {
          companyId,
          productId: product.id,
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
          performedById,
        },
      });
    });
  }
}
