import { randomBytes, randomInt, createHash } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Prisma, PrismaClient } from '@worksphere/database';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { SAFE_USER_SELECT } from '../common/constants/safe-user-select';
import { EmailService } from '../email/email.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

const BCRYPT_ROUNDS = 12;
/** Cât timp are un cont demis să ceară ștergerea imediată înainte de ștergerea automată — vezi `AccountDeletionService`. */
const ACCOUNT_DELETION_GRACE_DAYS = 7;

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  findAll() {
    return this.prisma.tenantScoped.employee.findMany({
      where: { companyId: TenantContext.requireCompanyId() },
      include: { user: { select: SAFE_USER_SELECT }, department: true },
      orderBy: { employeeCode: 'asc' },
    });
  }

  async findOne(id: string) {
    // `findFirst` (nu `findUnique`) ca să putem filtra explicit și pe
    // `companyId`, nu doar pe `id` — RLS nu trebuie să rămână singurul
    // strat care împiedică accesul la un rând din altă companie.
    const employee = await this.prisma.tenantScoped.employee.findFirst({
      where: { id, companyId: TenantContext.requireCompanyId() },
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
   *
   * Întoarce `{ deletionCode }` (null dacă era deja suspendat, deci fără
   * cod nou) — folosit intern de teste, ca să poată verifica ciclul complet
   * de accelerare a ștergerii fără un cont Resend real (vezi
   * `AuthService.forgotPassword` pentru același tipar). Controller-ul HTTP
   * ignoră deliberat valoarea întoarsă: răspunsul rămâne 204.
   */
  async remove(id: string, currentUserId: string): Promise<{ deletionCode: string | null }> {
    const employee = await this.findOne(id);

    if (employee.userId === currentUserId) {
      throw new ForbiddenException('Nu te poți demite singur.');
    }

    const founder = await this.prisma.tenantScoped.employee.findFirst({
      where: { companyId: TenantContext.requireCompanyId() },
      orderBy: { createdAt: 'asc' },
    });
    if (founder?.id === id) {
      throw new ForbiddenException('Fondatorul companiei nu poate fi demis de alți utilizatori.');
    }

    // Email + programare de ștergere automată doar la tranziția reală
    // ACTIV -> SUSPENDAT — o demitere repetată (apel dublu pe un cont deja
    // demis) nu trebuie să retrimită emailul și să reseteze termenul de 7 zile.
    const alreadySuspended = employee.user.status === 'SUSPENDED';

    await this.prisma.runInTenantTransaction(async (tx) => {
      await tx.user.update({ where: { id: employee.userId }, data: { status: 'SUSPENDED' } });
      await tx.employee.update({ where: { id }, data: { endDate: new Date() } });
    });

    if (alreadySuspended) return { deletionCode: null };
    const deletionCode = await this.scheduleAccountDeletion(
      employee.userId,
      employee.user.email,
      employee.user.firstName,
    );
    return { deletionCode };
  }

  /**
   * Programează ștergerea automată (peste `ACCOUNT_DELETION_GRACE_DAYS`
   * zile — vezi cron-ul din `AccountDeletionService`) și trimite emailul cu
   * codul + link-ul de accelerare. Nu blochează/anulează demiterea dacă
   * eșuează (email sau creare rând) — la fel ca `sendWelcomeEmail`, e un
   * bonus, nu o condiție a acțiunii principale (contul e oricum deja
   * suspendat, cron-ul îl va prelua eventual chiar dacă acest pas a eșuat
   * azi — de reîncercat manual sau la următoarea demitere, dacă se repetă).
   * Întoarce codul generat (sau `null` la eșec) — vezi doc-comentariul de pe `remove()`.
   */
  private async scheduleAccountDeletion(
    userId: string,
    toEmail: string,
    firstName: string,
  ): Promise<string | null> {
    try {
      const company = await this.prisma.tenantScoped.company.findUnique({
        where: { id: TenantContext.requireCompanyId() },
        select: { name: true },
      });
      const code = randomInt(100_000, 1_000_000).toString();
      const codeHash = createHash('sha256').update(code).digest('hex');
      const scheduledDeletionAt = new Date(
        Date.now() + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000,
      );

      await this.prisma.tenantScoped.accountDeletionRequest.create({
        data: { userId, codeHash, scheduledDeletionAt },
      });

      const frontendUrl = this.config.get<string>('app.frontendUrl');
      const confirmUrl = `${frontendUrl}/account-deletion/confirm?email=${encodeURIComponent(toEmail)}`;
      await this.email.sendAccountSuspensionEmail({
        to: toEmail,
        firstName,
        companyName: company?.name ?? '',
        code,
        confirmUrl,
        gracePeriodDays: ACCOUNT_DELETION_GRACE_DAYS,
      });
      return code;
    } catch (error) {
      this.logger.warn(
        `Programarea ștergerii automate pentru ${toEmail} a eșuat: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
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
   * NU curăță manual referințele opționale spre `User` (`LeaveRequest.approvedById`,
   * `AuditLog.userId`, `Client`/`Lead.ownerId`, `Task.assigneeId`/`createdById`,
   * `TaskComment`/`CrmNote`/`ChatMessage.authorId`, `Document.uploadedById`,
   * `TimeEntry.userId`, `CalendarEvent.createdById`) — toate au `onDelete: SetNull`
   * la nivel de bază de date (Prisma îl generează automat pentru relații
   * opționale), deci Postgres le nulează singur, corect, chiar și sub RLS
   * (verificat direct: constrângerea de FK declanșează `SET NULL` ca parte a
   * ștergerii, nu ca un UPDATE separat supus politicii RLS obișnuite).
   * `wipeUserContentAndDelete` mai jos e reutilizată și de fluxul automat de
   * ștergere programată (`AccountDeletionService`).
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
      where: { companyId: TenantContext.requireCompanyId() },
      orderBy: { createdAt: 'asc' },
    });
    if (founder?.id === id) {
      throw new ForbiddenException('Fondatorul companiei nu poate fi șters.');
    }

    await this.prisma.runInTenantTransaction((tx) =>
      wipeUserContentAndDelete(tx, { employeeId: id, userId: employee.userId }),
    );
  }
}

type TenantTxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Șterge definitiv fișa HR + contul — extrasă din `hardDelete()` ca să
 * poată fi reutilizată de `AccountDeletionService` (cron-ul zilnic de
 * ștergere automată + confirmarea publică de accelerare din email), care
 * rulează sub `PrismaService.runBypassingRls` (fără context de tenant),
 * nu sub `runInTenantTransaction`. Nu necesită nicio curățare manuală de
 * referințe — vezi comentariul de pe `hardDelete()`.
 */
export async function wipeUserContentAndDelete(
  tx: TenantTxClient,
  params: { employeeId: string; userId: string },
): Promise<void> {
  await tx.employee.delete({ where: { id: params.employeeId } });
  await tx.user.delete({ where: { id: params.userId } });
}
