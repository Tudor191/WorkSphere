import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { SAFE_USER_SELECT } from '../common/constants/safe-user-select';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.tenantScoped.client.findMany({
      where: { companyId: TenantContext.requireCompanyId() },
      include: {
        owner: { select: SAFE_USER_SELECT },
        _count: { select: { tasks: true, notes: true, projects: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.tenantScoped.client.findUnique({
      where: { id },
      include: {
        owner: { select: SAFE_USER_SELECT },
        _count: { select: { tasks: true, notes: true, projects: true } },
      },
    });
    if (!client) throw new NotFoundException('Client inexistent.');
    return client;
  }

  create(dto: CreateClientDto) {
    return this.prisma.tenantScoped.client.create({
      data: { ...dto, companyId: TenantContext.requireCompanyId() },
    });
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    return this.prisma.tenantScoped.client.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const client = await this.findOne(id);
    if (client._count.tasks > 0 || client._count.projects > 0) {
      throw new ConflictException(
        'Clientul are task-uri sau proiecte asociate — mută-le înainte de a-l șterge.',
      );
    }
    await this.prisma.tenantScoped.client.delete({ where: { id } });
  }
}
