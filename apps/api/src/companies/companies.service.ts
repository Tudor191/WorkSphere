import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { DeleteCompanyDto } from './dto/delete-company.dto';

/**
 * `Company` nu e un tabel `[TENANT]` (e rădăcina izolării, nu poate avea
 * RLS pe el însuși) — deci nu beneficiază de backstop-ul RLS ca restul
 * tabelelor. Din acest motiv, ID-ul companiei asupra căreia se operează
 * vine STRICT din `TenantContext` (derivat din JWT-ul verificat), niciodată
 * dintr-un parametru de request — altfel un utilizator ar putea cere/edita
 * datele altei companii doar schimbând un ID în URL.
 */
@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCurrent() {
    const companyId = TenantContext.requireCompanyId();
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Companie inexistentă.');
    return company;
  }

  async updateCurrent(dto: UpdateCompanyDto) {
    const companyId = TenantContext.requireCompanyId();
    return this.prisma.company.update({ where: { id: companyId }, data: dto });
  }

  /**
   * Reset de date demo/test — șterge istoricul cererilor de concediu și
   * readuce soldurile la zero zile consumate (nu la `totalDays`, care rămâne
   * neschimbat). Categorie separată de pontaj în mod deliberat, ca un admin
   * să poată reseta doar ce are nevoie, nu tot deodată.
   */
  async resetLeaveData() {
    const companyId = TenantContext.requireCompanyId();
    return this.prisma.runInTenantTransaction(async (tx) => {
      const { count: deletedRequests } = await tx.leaveRequest.deleteMany({ where: { companyId } });
      const { count: resetBalances } = await tx.leaveBalance.updateMany({
        where: { companyId },
        data: { usedDays: 0 },
      });
      return { deletedRequests, resetBalances };
    });
  }

  async resetAttendanceData() {
    const companyId = TenantContext.requireCompanyId();
    const { count: deletedRecords } = await this.prisma.tenantScoped.attendanceRecord.deleteMany({
      where: { companyId },
    });
    return { deletedRecords };
  }

  async getSubscription() {
    const companyId = TenantContext.requireCompanyId();
    const [subscription, plans] = await Promise.all([
      this.prisma.tenantScoped.subscription.findUnique({
        where: { companyId },
        include: { plan: true },
      }),
      this.prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: { priceMonthlyCents: 'asc' },
      }),
    ]);
    return { subscription, plans };
  }

  async updateSubscription(dto: UpdateSubscriptionDto) {
    const companyId = TenantContext.requireCompanyId();
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { slug: dto.planSlug } });
    if (!plan) throw new NotFoundException('Plan inexistent.');
    // De când există `BillingService` (checkout Stripe real), acest endpoint
    // nu mai are voie să atribuie direct un plan PLĂTIT — ar însemna upgrade
    // gratuit, fără nicio plată. Rămâne util doar pentru downgrade la planul
    // gratuit (`trial`); orice plan cu preț trece obligatoriu prin
    // `POST /billing/checkout`.
    if (plan.priceMonthlyCents > 0) {
      throw new ForbiddenException(
        'Planurile plătite se activează prin checkout (POST /billing/checkout), nu direct.',
      );
    }

    return this.prisma.tenantScoped.subscription.update({
      where: { companyId },
      data: { planId: plan.id },
      include: { plan: true },
    });
  }

  /**
   * Export complet al datelor companiei, în format JSON — dreptul la
   * portabilitatea datelor (GDPR, art. 20). Acoperă toate domeniile de
   * business relevante; exclude deliberat artefactele interne care nu sunt
   * "date" în sensul GDPR: hash-uri/token-uri de securitate (parole,
   * refresh tokens, coduri de resetare), embeddings vectoriale RAG (derivate
   * din documente, nu sursă) și tabelele de legătură pur tehnice (ex.
   * `ChatChannelMember`) a căror informație utilă (cine a scris ce) e deja
   * inclusă prin entitatea principală.
   *
   * Toate interogările sunt scopate explicit pe `companyId` (redundant cu
   * RLS, dar convenția stabilită în tot serviciul — vezi `resetLeaveData`).
   */
  async exportData() {
    const companyId = TenantContext.requireCompanyId();
    const scoped = this.prisma.tenantScoped;

    const [
      company,
      users,
      roles,
      departments,
      employees,
      leaveTypes,
      leaveRequests,
      leaveBalances,
      attendanceRecords,
      calendarEvents,
      documents,
      clients,
      leads,
      pipelineStages,
      crmNotes,
      products,
      stockMovements,
      projects,
      projectMembers,
      tasks,
      taskComments,
      timeEntries,
      chatChannels,
      chatMessages,
      notifications,
      auditLogs,
    ] = await Promise.all([
      scoped.company.findUnique({ where: { id: companyId } }),
      scoped.user.findMany({
        where: { companyId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          roleId: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      scoped.role.findMany({
        where: { companyId },
        include: { rolePermissions: { include: { permission: true } } },
      }),
      scoped.department.findMany({ where: { companyId } }),
      scoped.employee.findMany({ where: { companyId } }),
      scoped.leaveType.findMany({ where: { companyId } }),
      scoped.leaveRequest.findMany({ where: { companyId } }),
      scoped.leaveBalance.findMany({ where: { companyId } }),
      scoped.attendanceRecord.findMany({ where: { companyId } }),
      scoped.calendarEvent.findMany({
        where: { companyId },
        include: { attendees: { select: { userId: true } } },
      }),
      scoped.document.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          category: true,
          mimeType: true,
          sizeBytes: true,
          employeeId: true,
          uploadedById: true,
          createdAt: true,
        },
      }),
      scoped.client.findMany({ where: { companyId } }),
      scoped.lead.findMany({ where: { companyId } }),
      scoped.pipelineStage.findMany({ where: { companyId } }),
      scoped.crmNote.findMany({ where: { companyId } }),
      scoped.product.findMany({ where: { companyId } }),
      scoped.stockMovement.findMany({ where: { companyId } }),
      scoped.project.findMany({ where: { companyId } }),
      scoped.projectMember.findMany({ where: { project: { companyId } } }),
      scoped.task.findMany({ where: { companyId } }),
      scoped.taskComment.findMany({ where: { task: { companyId } } }),
      scoped.timeEntry.findMany({ where: { companyId } }),
      scoped.chatChannel.findMany({ where: { companyId } }),
      scoped.chatMessage.findMany({ where: { channel: { companyId } } }),
      scoped.notification.findMany({ where: { companyId } }),
      scoped.auditLog.findMany({ where: { companyId } }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      company,
      users,
      roles,
      departments,
      employees,
      leaveTypes,
      leaveRequests,
      leaveBalances,
      attendanceRecords,
      calendarEvents,
      documents,
      clients,
      leads,
      pipelineStages,
      crmNotes,
      products,
      stockMovements,
      projects,
      projectMembers,
      tasks,
      taskComments,
      timeEntries,
      chatChannels,
      chatMessages,
      notifications,
      auditLogs,
    };
  }

  /**
   * Ștergere definitivă a COMPANIEI ÎNTREGI, cerută de propriul ei Admin din
   * Setări — dreptul la ștergere (GDPR, art. 17), extins de la fluxul care
   * exista doar în panoul PlatformAdmin (`PlatformAdminService.deleteCompany`)
   * la orice Admin, din aplicație. Afectează TOȚI utilizatorii companiei,
   * nu doar cel care cere ștergerea — spre deosebire de
   * `AuthService.deleteOwnAccount`, care șterge toată compania DOAR dacă
   * adminul e singurul cont rămas.
   *
   * `runBypassingRls` (nu `TenantContext.runAsBypass`, restricționat la
   * `AuthService`): cascada `onDelete: Cascade` de pe `Company` atinge tabele
   * [TENANT] cu RLS (ex. `users`), deci sesiunea de ștergere are nevoie de
   * bypass, la fel ca `PlatformAdminService.deleteCompany`.
   */
  async deleteCurrent(
    userId: string,
    dto: DeleteCompanyDto,
  ): Promise<{ deletedCompanyId: string }> {
    const companyId = TenantContext.requireCompanyId();
    const admin = await this.prisma.tenantScoped.user.findUniqueOrThrow({ where: { id: userId } });

    if (admin.passwordHash) {
      const passwordMatches = dto.password
        ? await bcrypt.compare(dto.password, admin.passwordHash)
        : false;
      if (!passwordMatches) {
        throw new UnauthorizedException('Parola introdusă este incorectă.');
      }
    }

    this.logger.warn(
      `Admin ${admin.email} (${userId}) șterge propria companie (${companyId}) și toate datele ei.`,
    );
    await this.prisma.runBypassingRls((tx) => tx.company.delete({ where: { id: companyId } }));
    this.logger.warn(`Compania ${companyId} a fost ștearsă (cerere GDPR proprie).`);
    return { deletedCompanyId: companyId };
  }
}
