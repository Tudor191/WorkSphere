import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.tenantScoped.department.findMany({
      where: { companyId: TenantContext.requireCompanyId() },
      include: { _count: { select: { employees: true, subDepartments: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const department = await this.prisma.tenantScoped.department.findUnique({
      where: { id },
      include: { subDepartments: true, employees: true },
    });
    if (!department) throw new NotFoundException('Departament inexistent.');
    return department;
  }

  create(dto: CreateDepartmentDto) {
    return this.prisma.tenantScoped.department.create({
      data: { ...dto, companyId: TenantContext.requireCompanyId() },
    });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findOne(id);
    return this.prisma.tenantScoped.department.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const department = await this.findOne(id);
    if (department.employees.length > 0 || department.subDepartments.length > 0) {
      throw new ConflictException(
        'Departamentul are angajați sau sub-departamente asociate — mută-le înainte de ștergere.',
      );
    }
    await this.prisma.tenantScoped.department.delete({ where: { id } });
  }
}
