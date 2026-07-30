import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.tenantScoped.role.findMany({
      select: { id: true, name: true, systemKey: true, isSystem: true },
      orderBy: { name: 'asc' },
    });
  }
}
