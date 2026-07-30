import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { SAFE_USER_SELECT } from '../common/constants/safe-user-select';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';

function parseHoursMinutes(value: string): { hours: number; minutes: number } {
  const [hours, minutes] = value.split(':').map(Number);
  return { hours: hours ?? 9, minutes: minutes ?? 0 };
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async checkIn(dto: CheckInDto) {
    const employee = await this.requireCurrentEmployee();
    const openRecord = await this.prisma.tenantScoped.attendanceRecord.findFirst({
      where: { employeeId: employee.id, checkOutAt: null },
    });
    if (openRecord) {
      throw new ConflictException('Există deja un pontaj activ (fără check-out).');
    }

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: TenantContext.requireCompanyId() },
    });
    const checkInAt = new Date();
    const { hours, minutes } = parseHoursMinutes(company.workingHoursStart);
    const scheduledStart = new Date(checkInAt);
    scheduledStart.setHours(hours, minutes, 0, 0);
    const isLate = checkInAt.getTime() > scheduledStart.getTime() + 15 * 60 * 1000;

    return this.prisma.tenantScoped.attendanceRecord.create({
      data: {
        companyId: TenantContext.requireCompanyId(),
        employeeId: employee.id,
        checkInAt,
        checkInLat: dto.lat,
        checkInLng: dto.lng,
        status: isLate ? 'LATE' : 'PRESENT',
      },
    });
  }

  async checkOut(dto: CheckOutDto) {
    const employee = await this.requireCurrentEmployee();
    const openRecord = await this.prisma.tenantScoped.attendanceRecord.findFirst({
      where: { employeeId: employee.id, checkOutAt: null },
      orderBy: { checkInAt: 'desc' },
    });
    if (!openRecord) {
      throw new NotFoundException('Nu există niciun check-in activ.');
    }

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: TenantContext.requireCompanyId() },
    });
    const checkOutAt = new Date();
    const workedMinutes = Math.round(
      (checkOutAt.getTime() - openRecord.checkInAt.getTime()) / 60000,
    );

    const start = parseHoursMinutes(company.workingHoursStart);
    const end = parseHoursMinutes(company.workingHoursEnd);
    const standardMinutes = end.hours * 60 + end.minutes - (start.hours * 60 + start.minutes);
    const overtimeMinutes = Math.max(0, workedMinutes - standardMinutes);

    return this.prisma.tenantScoped.attendanceRecord.update({
      where: { id: openRecord.id },
      data: {
        checkOutAt,
        checkOutLat: dto.lat,
        checkOutLng: dto.lng,
        workedMinutes,
        overtimeMinutes,
      },
    });
  }

  async findMine() {
    const employee = await this.requireCurrentEmployee();
    return this.prisma.tenantScoped.attendanceRecord.findMany({
      where: { employeeId: employee.id },
      orderBy: { checkInAt: 'desc' },
      take: 100,
    });
  }

  findAll() {
    return this.prisma.tenantScoped.attendanceRecord.findMany({
      include: { employee: { include: { user: { select: SAFE_USER_SELECT } } } },
      orderBy: { checkInAt: 'desc' },
      take: 200,
    });
  }

  /** Raport lunar agregat per angajat — bază pentru export PDF/Excel (roadmap). */
  async monthlyReport(year: number, month: number) {
    const startOfMonth = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);

    const records = await this.prisma.tenantScoped.attendanceRecord.findMany({
      where: { checkInAt: { gte: startOfMonth, lt: startOfNextMonth } },
      include: { employee: { include: { user: { select: SAFE_USER_SELECT } } } },
    });

    const byEmployee = new Map<
      string,
      {
        employeeId: string;
        name: string;
        daysPresent: number;
        workedMinutes: number;
        overtimeMinutes: number;
      }
    >();

    for (const record of records) {
      const key = record.employeeId;
      const entry = byEmployee.get(key) ?? {
        employeeId: key,
        name: `${record.employee.user.firstName} ${record.employee.user.lastName}`,
        daysPresent: 0,
        workedMinutes: 0,
        overtimeMinutes: 0,
      };
      entry.daysPresent += 1;
      entry.workedMinutes += record.workedMinutes ?? 0;
      entry.overtimeMinutes += record.overtimeMinutes;
      byEmployee.set(key, entry);
    }

    return Array.from(byEmployee.values());
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
}
