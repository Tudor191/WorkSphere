import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.tenantScoped.project.findMany({
      where: { companyId: TenantContext.requireCompanyId() },
      include: { _count: { select: { tasks: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    // `findFirst` (nu `findUnique`) ca să putem filtra explicit și pe
    // `companyId`, nu doar pe `id` — RLS nu trebuie să rămână singurul
    // strat care împiedică accesul la un rând din altă companie.
    const project = await this.prisma.tenantScoped.project.findFirst({
      where: { id, companyId: TenantContext.requireCompanyId() },
      include: {
        tasks: { orderBy: { createdAt: 'desc' } },
        _count: { select: { tasks: true } },
      },
    });
    if (!project) throw new NotFoundException('Proiect inexistent.');
    return project;
  }

  create(dto: CreateProjectDto) {
    return this.prisma.tenantScoped.project.create({
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        companyId: TenantContext.requireCompanyId(),
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);
    return this.prisma.tenantScoped.project.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
    });
  }

  async remove(id: string) {
    const project = await this.findOne(id);
    if (project._count.tasks > 0) {
      throw new ConflictException(
        'Proiectul are task-uri asociate — mută-le sau șterge-le înainte de a șterge proiectul.',
      );
    }
    await this.prisma.tenantScoped.project.delete({ where: { id } });
  }
}
