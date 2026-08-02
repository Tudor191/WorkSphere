import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { SAFE_USER_SELECT } from '../common/constants/safe-user-select';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const TASK_INCLUDE = {
  assignee: { select: SAFE_USER_SELECT },
  createdBy: { select: SAFE_USER_SELECT },
  project: { select: { id: true, name: true } },
} as const;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(projectId?: string) {
    return this.prisma.tenantScoped.task.findMany({
      where: {
        companyId: TenantContext.requireCompanyId(),
        ...(projectId ? { projectId } : {}),
      },
      include: TASK_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    // `findFirst` (nu `findUnique`) ca să putem filtra explicit și pe
    // `companyId`, nu doar pe `id` — RLS nu trebuie să rămână singurul
    // strat care împiedică accesul la un rând din altă companie.
    const task = await this.prisma.tenantScoped.task.findFirst({
      where: { id, companyId: TenantContext.requireCompanyId() },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException('Task inexistent.');
    return task;
  }

  create(dto: CreateTaskDto, createdById: string) {
    const { dueDate, ...rest } = dto;
    return this.prisma.tenantScoped.task.create({
      data: {
        ...rest,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        companyId: TenantContext.requireCompanyId(),
        createdById,
      },
      include: TASK_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateTaskDto) {
    await this.findOne(id);
    const { dueDate, ...rest } = dto;
    return this.prisma.tenantScoped.task.update({
      where: { id },
      data: {
        ...rest,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      },
      include: TASK_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.tenantScoped.task.delete({ where: { id } });
  }
}
