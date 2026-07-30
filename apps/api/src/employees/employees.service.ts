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
        // NU folosi `count()` — de când există `hardDelete()`, numărul de
        // angajați poate SCĂDEA (un cont șters definitiv nu se mai numără),
        // deci count+1 poate coincide cu un cod deja folosit de un angajat
        // rămas cu un număr mai mare (ex: șterge EMP-0002 din 5, count
        // devine 4, dar EMP-0005 tot există → coliziune). Codul următor
        // trebuie să fie mereu mai mare decât cel mai mare cod EXISTENT.
        const lastEmployee = await tx.employee.findFirst({
          where: { companyId },
          orderBy: { employeeCode: 'desc' },
          select: { employeeCode: true },
        });
        const lastNumber = lastEmployee ? parseInt(lastEmployee.employeeCode.slice(4), 10) : 0;
        const employeeCode = `EMP-${String(lastNumber + 1).padStart(4, '0')}`;

        const user = await tx.user.create({
          data: {
            companyId,
            email: dto.email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            roleId: dto.roleId,
            status: 'ACTIVE',
            mustChangePassword: true,
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

  /**
   * Folosit și pentru promovare/retrogradare (schimbare rol + funcție).
   * Dacă angajatul e în prezent singurul Admin ACTIVE al companiei și
   * `roleId` l-ar scoate din rolul de Admin, blocăm schimbarea — altfel
   * compania rămâne fără niciun cont care poate gestiona roluri/angajați
   * (nimeni nu ar mai putea repara greșeala, inclusiv persoana însăși).
   */
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

    if (roleId && roleId !== existing.user.roleId) {
      const currentRole = await this.prisma.tenantScoped.role.findUnique({
        where: { id: existing.user.roleId },
      });
      if (currentRole?.systemKey === 'ADMIN') {
        const activeAdmins = await this.prisma.tenantScoped.user.count({
          where: { status: 'ACTIVE', role: { systemKey: 'ADMIN' } },
        });
        if (activeAdmins <= 1) {
          throw new ForbiddenException(
            'Nu poți schimba rolul singurului Administrator activ al companiei — atribuie rolul de Administrator altcuiva mai întâi.',
          );
        }
      }
    }

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
   * "Ștergere" = demitere (suspendare cont + închidere fișă HR), nu
   * DELETE fizic — un angajat demis din greșeală sau plecat din companie
   * trebuie să rămână în istoricul de audit/pontaj/concedii. Hard-delete
   * ar rupe integritatea rapoartelor istorice.
   *
   * Rangul rolului (Admin/Manager/etc.) nu contează aici — orice utilizator
   * cu permisiunea `employees:delete` poate demite pe oricine, INDIFERENT
   * de rol. Singurele două restricții: nu te poți demite pe tine însuți,
   * și fondatorul companiei (primul angajat creat, la înregistrare) nu
   * poate fi demis de altcineva — altfel un al doilea cont Admin ar
   * putea bloca accesul fondatorului la propria companie.
   */
  async remove(id: string, currentUserId: string) {
    const employee = await this.findOne(id);

    if (employee.userId === currentUserId) {
      throw new ForbiddenException('Nu te poți demite singur.');
    }

    const founder = await this.prisma.tenantScoped.employee.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (founder?.id === id) {
      throw new ForbiddenException('Fondatorul companiei nu poate fi demis de alți utilizatori.');
    }

    await this.prisma.runInTenantTransaction(async (tx) => {
      await tx.user.update({ where: { id: employee.userId }, data: { status: 'SUSPENDED' } });
      await tx.employee.update({ where: { id }, data: { endDate: new Date() } });
    });
  }

  /**
   * Ștergere definitivă (ireversibilă) din baza de date — spre deosebire de
   * `remove()`, care doar suspendă. Necesară în special ca email-ul demis
   * să poată fi refolosit la crearea unui cont nou (`email` e unic global,
   * vezi schema `User`). Rezervată nivelurilor 4-5 (Manager/Admin) — vezi
   * `RequirePermission('employees:hard_delete')` pe controller.
   *
   * Precondiție obligatorie: contul trebuie să fie DEJA suspendat (fluxul
   * e mereu demite → apoi, separat, șterge definitiv — niciodată direct),
   * ca un hard-delete accidental să nu fie la un click distanță pe un cont
   * încă activ.
   *
   * Curăță explicit referințele opționale care nu au CASCADE în schemă
   * (`LeaveRequest.approvedById`, `AuditLog.userId`) — altfel ștergerea ar
   * eșua pe constrângere de FK pentru orice Manager/Admin care a aprobat
   * vreodată o cerere sau a făcut vreo acțiune auditată. Modulele
   * neimplementate încă (Documente, CRM, Proiecte, Chat) au propriile
   * referințe fără CASCADE către User — nu sunt curățate aici pentru că
   * azi nu pot conține date (nu există endpoint-uri care să scrie în ele);
   * de revizuit când acele module devin funcționale.
   */
  async hardDelete(id: string, currentUserId: string) {
    const employee = await this.findOne(id);

    if (employee.userId === currentUserId) {
      throw new ForbiddenException('Nu îți poți șterge propriul cont.');
    }
    if (employee.user.status !== 'SUSPENDED') {
      throw new ConflictException(
        'Contul trebuie demis (dezactivat) înainte de a putea fi șters definitiv.',
      );
    }

    const founder = await this.prisma.tenantScoped.employee.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (founder?.id === id) {
      throw new ForbiddenException('Fondatorul companiei nu poate fi șters.');
    }

    await this.prisma.runInTenantTransaction(async (tx) => {
      await tx.leaveRequest.updateMany({
        where: { approvedById: employee.userId },
        data: { approvedById: null },
      });
      await tx.auditLog.updateMany({
        where: { userId: employee.userId },
        data: { userId: null },
      });
      await tx.employee.delete({ where: { id } });
      await tx.user.delete({ where: { id: employee.userId } });
    });
  }
}
