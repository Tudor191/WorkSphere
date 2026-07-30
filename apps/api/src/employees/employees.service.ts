import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@worksphere/database';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { SAFE_USER_SELECT } from '../common/constants/safe-user-select';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.tenantScoped.employee.findMany({
      include: { user: { select: SAFE_USER_SELECT }, department: true },
      orderBy: { employeeCode: 'asc' },
    });
  }

  async findOne(id: string) {
    const employee = await this.prisma.tenantScoped.employee.findUnique({
      where: { id },
      include: {
        user: { select: SAFE_USER_SELECT },
        department: true,
        manager: { include: { user: { select: SAFE_USER_SELECT } } },
      },
    });
    if (!employee) throw new NotFoundException('Angajat inexistent.');
    return employee;
  }

  /**
   * Creează contul de autentificare (`User`) + fișa HR (`Employee`) într-o
   * singură tranzacție atomică (`runInTenantTransaction` — vezi
   * `PrismaService`: setează contextul de tenant o singură dată și rulează
   * ambele scrieri pe același client `tx`, altfel fiecare apel prin
   * `tenantScoped` ar deschide propria mini-tranzacție separată și
   * atomicitatea s-ar pierde). Parola temporară e generată aici și
   * întoarsă o singură dată în răspuns — în producție, acest flux trebuie
   * să trimită un email de invitație (Resend, vezi `docs/ROADMAP.md`) cu
   * link de setare a parolei, nu parola în clar. E documentat explicit ca
   * gap cunoscut, nu implementat fals ca "email trimis".
   */
  async create(dto: CreateEmployeeDto): Promise<{ employee: unknown; temporaryPassword: string }> {
    const companyId = TenantContext.requireCompanyId();
    const temporaryPassword = randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    try {
      const employee = await this.prisma.runInTenantTransaction(async (tx) => {
        const employeeCount = await tx.employee.count({ where: { companyId } });
        const employeeCode = `EMP-${String(employeeCount + 1).padStart(4, '0')}`;

        const user = await tx.user.create({
          data: {
            companyId,
            email: dto.email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            roleId: dto.roleId,
            status: 'ACTIVE',
          },
        });

        return tx.employee.create({
          data: {
            companyId,
            userId: user.id,
            employeeCode,
            departmentId: dto.departmentId,
            position: dto.position,
            contractType: dto.contractType,
            hireDate: new Date(dto.hireDate),
            annualLeaveDays: dto.annualLeaveDays ?? 21,
          },
          include: { user: { select: SAFE_USER_SELECT } },
        });
      });

      return { employee, temporaryPassword };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Există deja un cont cu acest email.');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const existing = await this.findOne(id);
    const {
      managerId,
      roleId,
      departmentId,
      contractType,
      hireDate,
      annualLeaveDays,
      position,
      ...userFields
    } = dto;

    return this.prisma.runInTenantTransaction(async (tx) => {
      if (Object.keys(userFields).length > 0 || roleId) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { ...userFields, ...(roleId ? { roleId } : {}) },
        });
      }

      return tx.employee.update({
        where: { id },
        data: {
          ...(managerId !== undefined ? { managerId } : {}),
          ...(departmentId !== undefined ? { departmentId } : {}),
          ...(contractType !== undefined ? { contractType } : {}),
          ...(hireDate !== undefined ? { hireDate: new Date(hireDate) } : {}),
          ...(annualLeaveDays !== undefined ? { annualLeaveDays } : {}),
          ...(position !== undefined ? { position } : {}),
        },
        include: { user: { select: SAFE_USER_SELECT } },
      });
    });
  }

  /**
   * "Ștergere" = dezactivare (suspendare cont + închidere fișă HR), nu
   * DELETE fizic — un angajat șters din greșeală sau plecat din companie
   * trebuie să rămână în istoricul de audit/pontaj/concedii. Hard-delete
   * ar rupe integritatea rapoartelor istorice.
   *
   * Rangul rolului (Admin/Manager/etc.) nu contează aici — orice utilizator
   * cu permisiunea `employees:delete` poate dezactiva pe oricine, INDIFERENT
   * de rol. Singurele două restricții: nu te poți dezactiva pe tine însuți,
   * și fondatorul companiei (primul angajat creat, la înregistrare) nu
   * poate fi dezactivat de altcineva — altfel un al doilea cont Admin ar
   * putea bloca accesul fondatorului la propria companie.
   */
  async remove(id: string, currentUserId: string) {
    const employee = await this.findOne(id);

    if (employee.userId === currentUserId) {
      throw new ForbiddenException('Nu îți poți dezactiva propriul cont.');
    }

    const founder = await this.prisma.tenantScoped.employee.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (founder?.id === id) {
      throw new ForbiddenException(
        'Fondatorul companiei nu poate fi dezactivat de alți utilizatori.',
      );
    }

    await this.prisma.runInTenantTransaction(async (tx) => {
      await tx.user.update({ where: { id: employee.userId }, data: { status: 'SUSPENDED' } });
      await tx.employee.update({ where: { id }, data: { endDate: new Date() } });
    });
  }
}
