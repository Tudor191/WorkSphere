import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { SAFE_USER_SELECT } from '../common/constants/safe-user-select';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.tenantScoped.lead.findMany({
      where: { companyId: TenantContext.requireCompanyId() },
      include: { owner: { select: SAFE_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const lead = await this.prisma.tenantScoped.lead.findUnique({
      where: { id },
      include: { owner: { select: SAFE_USER_SELECT } },
    });
    if (!lead) throw new NotFoundException('Lead inexistent.');
    return lead;
  }

  create(dto: CreateLeadDto) {
    return this.prisma.tenantScoped.lead.create({
      data: { ...dto, companyId: TenantContext.requireCompanyId() },
    });
  }

  async update(id: string, dto: UpdateLeadDto) {
    await this.findOne(id);
    return this.prisma.tenantScoped.lead.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.tenantScoped.lead.delete({ where: { id } });
  }
}
