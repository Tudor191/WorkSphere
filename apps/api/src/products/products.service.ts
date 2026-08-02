import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@worksphere/database';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.tenantScoped.product.findMany({
      where: { companyId: TenantContext.requireCompanyId() },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    // `findFirst` (nu `findUnique`) ca să putem filtra explicit și pe
    // `companyId`, nu doar pe `id` — RLS nu trebuie să rămână singurul
    // strat care împiedică accesul la un rând din altă companie.
    const product = await this.prisma.tenantScoped.product.findFirst({
      where: { id, companyId: TenantContext.requireCompanyId() },
      include: { stockMovements: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!product) throw new NotFoundException('Produs inexistent.');
    return product;
  }

  async create(dto: CreateProductDto) {
    try {
      return await this.prisma.tenantScoped.product.create({
        data: { ...dto, companyId: TenantContext.requireCompanyId() },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Există deja un produs cu acest SKU.');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    try {
      return await this.prisma.tenantScoped.product.update({ where: { id }, data: dto });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Există deja un produs cu acest SKU.');
      }
      throw error;
    }
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    if (Number(product.stockQuantity) > 0) {
      throw new ConflictException(
        'Produsul mai are stoc înregistrat — scade-l la 0 printr-o mișcare de ieșire înainte de ștergere.',
      );
    }
    await this.prisma.tenantScoped.product.delete({ where: { id } });
  }
}
