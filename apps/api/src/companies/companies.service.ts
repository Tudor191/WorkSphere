import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { UpdateCompanyDto } from './dto/update-company.dto';

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
}
