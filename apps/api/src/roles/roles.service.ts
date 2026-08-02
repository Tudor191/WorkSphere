import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.tenantScoped.role.findMany({
      where: { companyId: TenantContext.requireCompanyId() },
      select: { id: true, name: true, systemKey: true, isSystem: true },
      orderBy: { name: 'asc' },
    });
  }
}
