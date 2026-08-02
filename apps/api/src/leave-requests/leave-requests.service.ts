import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { SAFE_USER_SELECT } from '../common/constants/safe-user-select';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';

/** Numără zilele lucrătoare (luni-vineri) dintr-un interval, capete incluse. */
export function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * Determină dacă o cerere de concediu depășește soldul disponibil.
 * `capped: false` dacă tipul de concediu nu are nicio limită configurată
 * (nici sold explicit deja creat, nici `defaultDaysPerYear`) — un tip fără
 * limită NU trebuie tratat ca având 0 zile disponibile (vezi ISSUES.md #26,
 * cazul concediului medical, care în România nu se scade dintr-un plafon
 * personal fix).
 */
export function checkLeaveBalanceCap(input: {
  requestedDays: number;
  usedDays: number;
  existingTotalDays: number | null;
  defaultDaysPerYear: number | null;
}): { capped: boolean; exceeded: boolean; totalDays: number | null } {
  const totalDays = input.existingTotalDays ?? input.defaultDaysPerYear;
  if (totalDays === null || totalDays === undefined) {
    return { capped: false, exceeded: false, totalDays: null };
  }
  return { capped: true, exceeded: input.usedDays + input.requestedDays > totalDays, totalDays };
}

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  findAll() {
    return this.prisma.tenantScoped.leaveRequest.findMany({
      where: { companyId: TenantContext.requireCompanyId() },
      include: {
        employee: { include: { user: { select: SAFE_USER_SELECT } } },
        leaveType: true,
        approvedBy: { select: SAFE_USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Pentru badge-ul de notificare din sidebar, vizibil doar celor care pot aproba. */
  async countPending() {
    const count = await this.prisma.tenantScoped.leaveRequest.count({
      where: { companyId: TenantContext.requireCompanyId(), status: 'PENDING' },
    });
    return { count };
  }

  async findMine() {
    const employee = await this.requireCurrentEmployee();
    return this.prisma.tenantScoped.leaveRequest.findMany({
      where: { employeeId: employee.id },
      include: { leaveType: true, approvedBy: { select: SAFE_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBalances(employeeId: string) {
    return this.prisma.tenantScoped.leaveBalance.findMany({
      where: {
        companyId: TenantContext.requireCompanyId(),
        employeeId,
        year: new Date().getFullYear(),
      },
      include: { leaveType: true },
    });
  }

  async getMyBalances() {
    const employee = await this.requireCurrentEmployee();
    return this.getBalances(employee.id);
  }

  /**
   * Lista tipurilor de concediu ale companiei (Concediu de odihnă, medical
   * etc.) — separată de `getBalances`, care întoarce doar tipurile pentru
   * care angajatul are deja un sold creat. Fără acest endpoint, un angajat
   * nou (fără nicio cerere aprobată încă) nu are ce alege în formularul de
   * cerere de concediu, pentru că soldul se creează abia la aprobare.
   */
  getLeaveTypes() {
    return this.prisma.tenantScoped.leaveType.findMany({
      where: { companyId: TenantContext.requireCompanyId() },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateLeaveRequestDto) {
    const employee = await this.requireCurrentEmployee();
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new ConflictException('Data de sfârșit nu poate fi înainte de data de început.');
    }
    const daysCount = countBusinessDays(startDate, endDate);

    return this.prisma.tenantScoped.leaveRequest.create({
      data: {
        companyId: TenantContext.requireCompanyId(),
        employeeId: employee.id,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        daysCount,
        reason: dto.reason,
        status: 'PENDING',
      },
      include: { leaveType: true },
    });
  }

  /**
   * Aprobare — actualizează statusul ȘI soldul de concediu într-o singură
   * tranzacție atomică (vezi `PrismaService.runInTenantTransaction`):
   * dacă oricare pas eșuează, nici cererea nu rămâne "aprobată" cu soldul
   * neschimbat.
   */
  async approve(id: string, approvedById: string) {
    const updated = await this.prisma.runInTenantTransaction(async (tx) => {
      // `findFirst` (nu `findUnique`) ca să putem filtra explicit și pe
      // `companyId`, nu doar pe `id` — RLS nu trebuie să rămână singurul
      // strat care împiedică accesul la un rând din altă companie.
      const request = await tx.leaveRequest.findFirst({
        where: { id, companyId: TenantContext.requireCompanyId() },
        include: { leaveType: true },
      });
      if (!request) throw new NotFoundException('Cerere de concediu inexistentă.');
      if (request.status !== 'PENDING') {
        throw new ConflictException('Doar cererile în așteptare pot fi aprobate.');
      }

      const year = request.startDate.getFullYear();
      const existingBalance = await tx.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year,
          },
        },
      });

      const capCheck = checkLeaveBalanceCap({
        requestedDays: Number(request.daysCount),
        usedDays: Number(existingBalance?.usedDays ?? 0),
        existingTotalDays: existingBalance ? Number(existingBalance.totalDays) : null,
        defaultDaysPerYear: request.leaveType.defaultDaysPerYear,
      });
      if (capCheck.capped) {
        if (capCheck.exceeded) {
          throw new ConflictException(
            'Zile de concediu insuficiente în sold pentru această perioadă.',
          );
        }

        if (existingBalance) {
          await tx.leaveBalance.update({
            where: { id: existingBalance.id },
            data: { usedDays: { increment: request.daysCount } },
          });
        } else {
          await tx.leaveBalance.create({
            data: {
              companyId: request.companyId,
              employeeId: request.employeeId,
              leaveTypeId: request.leaveTypeId,
              year,
              totalDays: capCheck.totalDays!,
              usedDays: request.daysCount,
            },
          });
        }
      }

      return tx.leaveRequest.update({
        where: { id },
        data: { status: 'APPROVED', approvedById, approvedAt: new Date() },
        include: { leaveType: true },
      });
    });

    await this.notifyEmployee(updated.employeeId, {
      type: 'leave_request_approved',
      title: 'Cerere de concediu aprobată',
      body: `Cererea ta de concediu (${updated.leaveType.name}) a fost aprobată.`,
    });
    return updated;
  }

  async reject(id: string, approvedById: string, dto: RejectLeaveRequestDto) {
    // `findFirst` (nu `findUnique`) ca să putem filtra explicit și pe
    // `companyId`, nu doar pe `id` — RLS nu trebuie să rămână singurul
    // strat care împiedică accesul la un rând din altă companie.
    const request = await this.prisma.tenantScoped.leaveRequest.findFirst({
      where: { id, companyId: TenantContext.requireCompanyId() },
    });
    if (!request) throw new NotFoundException('Cerere de concediu inexistentă.');
    if (request.status !== 'PENDING') {
      throw new ConflictException('Doar cererile în așteptare pot fi respinse.');
    }
    const updated = await this.prisma.tenantScoped.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById,
        approvedAt: new Date(),
        rejectionReason: dto.rejectionReason,
      },
    });

    await this.notifyEmployee(updated.employeeId, {
      type: 'leave_request_rejected',
      title: 'Cerere de concediu respinsă',
      body: dto.rejectionReason
        ? `Cererea ta de concediu a fost respinsă: ${dto.rejectionReason}`
        : 'Cererea ta de concediu a fost respinsă.',
    });
    return updated;
  }

  async cancel(id: string) {
    const employee = await this.requireCurrentEmployee();
    // `findFirst` (nu `findUnique`) ca să putem filtra explicit și pe
    // `companyId`, nu doar pe `id` — RLS nu trebuie să rămână singurul
    // strat care împiedică accesul la un rând din altă companie.
    const request = await this.prisma.tenantScoped.leaveRequest.findFirst({
      where: { id, companyId: TenantContext.requireCompanyId() },
    });
    if (!request) throw new NotFoundException('Cerere de concediu inexistentă.');
    if (request.employeeId !== employee.id) {
      throw new ForbiddenException('Poți anula doar propriile cereri.');
    }
    if (request.status !== 'PENDING') {
      throw new ConflictException('Doar cererile în așteptare pot fi anulate.');
    }
    return this.prisma.tenantScoped.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELED' },
    });
  }

  private async requireCurrentEmployee() {
    const { userId } = TenantContext.get()!;
    const employee = await this.prisma.tenantScoped.employee.findUnique({
      where: { userId: userId! },
    });
    if (!employee) {
      throw new NotFoundException('Utilizatorul curent nu are o fișă de angajat asociată.');
    }
    return employee;
  }

  /**
   * Notificarea e un bonus, nu o condiție de succes a aprobării/respingerii
   * — orice eroare aici (ex. Firebase indisponibil) se loghează, nu se lasă
   * să strice răspunsul către cel care a aprobat/respins cererea.
   */
  private async notifyEmployee(
    employeeId: string,
    input: { type: string; title: string; body: string },
  ) {
    try {
      const employee = await this.prisma.tenantScoped.employee.findUnique({
        where: { id: employeeId },
        select: { userId: true },
      });
      if (employee) {
        // allowSms: aprobarea/respingerea unei cereri de concediu e
        // suficient de importantă (și rară) încât să merite un SMS, spre
        // deosebire de ex. un mesaj de chat (vezi ChatService).
        await this.notifications.notify(employee.userId, { ...input, allowSms: true });
      }
    } catch {
      // eșecul de notificare nu trebuie să strice fluxul de aprobare/respingere
    }
  }
}
