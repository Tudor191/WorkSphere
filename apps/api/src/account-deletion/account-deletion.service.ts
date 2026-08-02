import { createHash } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { wipeUserContentAndDelete } from '../employees/employees.service';
import { ConfirmAccountDeletionDto } from './dto/confirm-account-deletion.dto';

/**
 * Gestionează ștergerea automată/accelerată a conturilor demise — vezi
 * `EmployeesService.remove()` (creează `AccountDeletionRequest` + trimite
 * emailul cu codul). Ambele operații publice de aici rulează fără JWT/
 * context de tenant (contul e deja SUSPENDAT, deci nu se poate loga, iar
 * cron-ul nu are niciun request HTTP în spate) — folosesc
 * `PrismaService.runBypassingRls`, NU `TenantContext.runAsBypass` (restricționat
 * la `AuthService`).
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Endpoint public — fostul angajat (deja demis, deci fără sesiune activă)
   * confirmă email + codul primit prin email + parola contului, ca să
   * accelereze ștergerea definitivă în loc să aștepte termenul automat.
   * Eroare IDENTICĂ pentru orice combinație greșită (email/cod/parolă) —
   * altfel endpoint-ul ar deveni un oracol pentru ce email-uri au fost
   * recent demise, la fel ca filozofia din `AuthService.forgotPassword`.
   */
  async confirmEarlyDeletion(dto: ConfirmAccountDeletionDto): Promise<void> {
    const codeHash = createHash('sha256').update(dto.code).digest('hex');
    const genericError = () => new UnauthorizedException('Email, parolă sau cod incorecte.');

    await this.prisma.runBypassingRls(async (tx) => {
      const user = await tx.user.findUnique({ where: { email: dto.email } });
      if (!user || !user.passwordHash) throw genericError();

      const request = await tx.accountDeletionRequest.findFirst({
        where: { userId: user.id, codeHash },
        orderBy: { createdAt: 'desc' },
      });
      if (!request) throw genericError();

      const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
      if (!passwordMatches) throw genericError();

      // Orice cont demis are o fișă HR (creată la `EmployeesService.create`) —
      // dacă lipsește, ceva e deja incoerent; nu continuăm ștergerea "orbește".
      const employee = await tx.employee.findUnique({ where: { userId: user.id } });
      if (!employee) throw genericError();

      await wipeUserContentAndDelete(tx, { employeeId: employee.id, userId: user.id });
      this.logger.warn(
        `Cont ${dto.email} șters definitiv la cerere proprie (accelerare din email).`,
      );
    });
  }

  /**
   * Rulează zilnic — șterge definitiv orice cont a cărui perioadă de
   * grație (`scheduledDeletionAt`) a expirat fără accelerare manuală.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async processScheduledDeletions(): Promise<void> {
    const due = await this.prisma.runBypassingRls((tx) =>
      tx.accountDeletionRequest.findMany({ where: { scheduledDeletionAt: { lte: new Date() } } }),
    );

    for (const request of due) {
      try {
        await this.prisma.runBypassingRls(async (tx) => {
          const employee = await tx.employee.findUnique({ where: { userId: request.userId } });
          if (!employee) return;
          await wipeUserContentAndDelete(tx, { employeeId: employee.id, userId: request.userId });
        });
        this.logger.warn(
          `Cont ${request.userId} șters definitiv automat (perioadă de grație expirată).`,
        );
      } catch (error) {
        this.logger.error(
          `Ștergere automată eșuată pentru user ${request.userId}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }
}
