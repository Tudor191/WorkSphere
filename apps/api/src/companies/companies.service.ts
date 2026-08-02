import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

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
}
