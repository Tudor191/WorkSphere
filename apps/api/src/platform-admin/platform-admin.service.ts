import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { PlatformAdminJwtPayload } from '../auth/types/jwt-payload.type';
import { PlatformAdminLoginDto } from './dto/platform-admin-login.dto';

/**
 * Fraza de confirmare pentru „hard reset” — un gard de tip „scrie ca să
 * confirmi” (ca ștergerea unui repo pe GitHub), nu un secret criptografic:
 * oricine ajunge deja autentificat ca `PlatformAdmin` (protecția reală, vezi
 * `PlatformAdminGuard`) o poate citi din acest fișier sau din cod de pe
 * frontend. Rolul ei e să prevină un click accidental cu consecințe
 * ireversibile pe toată platforma, nu să blocheze un atacator.
 */
export const HARD_RESET_CONFIRMATION_PHRASE = 'imiplacepuiul';

const PLATFORM_ADMIN_TOKEN_TTL = '12h';

@Injectable()
export class PlatformAdminService {
  private readonly logger = new Logger(PlatformAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: PlatformAdminLoginDto): Promise<{
    accessToken: string;
    admin: { id: string; email: string; firstName: string; lastName: string };
  }> {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { email: dto.email } });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Email sau parolă incorectă.');
    }
    const passwordMatches = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Email sau parolă incorectă.');
    }

    const payload: PlatformAdminJwtPayload = {
      sub: admin.id,
      email: admin.email,
      type: 'platform_admin',
    };
    const accessToken = this.jwt.sign(payload, { expiresIn: PLATFORM_ADMIN_TOKEN_TTL });

    return {
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
      },
    };
  }

  /** Profilul complet pentru afișare — JWT-ul admin-ului nu conține numele. */
  async getProfile(id: string) {
    const admin = await this.prisma.platformAdmin.findUniqueOrThrow({ where: { id } });
    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
    };
  }

  async listCompanies() {
    // `users`/`employees` sunt tabele [TENANT] cu RLS — fără bypass, orice
    // query în afara unui context de tenant (ca acesta) le vede goale
    // (fail-closed), iar `_count` ar arăta mereu 0 indiferent de datele reale.
    // IMPORTANT: callback-ul trebuie să fie `async` și să facă `await`
    // efectiv pe interogare ÎN INTERIORUL lui — `AsyncLocalStorage` (folosit
    // de `TenantContext`) propagă contextul doar peste continuări create cât
    // timp store-ul e activ; interogările Prisma sunt lene (`.findMany(...)`
    // nu declanșează nimic până nu sunt `await`-uite), deci un callback
    // sincron care doar RETURNEAZĂ promisiunea (fără `await` înăuntru) ar
    // lăsa dispecerizarea reală a query-ului să se întâmple DUPĂ ce
    // `runAsBypass` s-a încheiat deja — în afara contextului de bypass.
    const companies = await TenantContext.runAsBypass(async () => {
      return await this.prisma.tenantScoped.company.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { users: true, employees: true } } },
      });
    });
    return companies.map((company) => ({
      id: company.id,
      slug: company.slug,
      name: company.name,
      isActive: company.isActive,
      createdAt: company.createdAt,
      userCount: company._count.users,
      employeeCount: company._count.employees,
    }));
  }

  /**
   * Șterge ABSOLUT toate companiile și, prin cascadă la nivel de bază de
   * date, tot ce depinde de ele (utilizatori, angajați, concedii, pontaje,
   * documente etc.) — catalogul global (`Permission`, `SubscriptionPlan`,
   * `PlatformAdmin`) nu e afectat, pentru că nu are `companyId`.
   *
   * Rulează sub `TenantContext.runAsBypass`: cascada de ștergere trebuie să
   * treacă prin RLS pe tabelele tenant-scoped (ex. `users`), iar politica
   * lor permite asta STRICT când `app.bypass_rls = true` — fără bypass,
   * Postgres ar respinge cascada și `DELETE FROM companies` ar eșua complet.
   */
  async hardReset(adminId: string, adminEmail: string, confirmationPhrase: string) {
    if (confirmationPhrase !== HARD_RESET_CONFIRMATION_PHRASE) {
      throw new UnauthorizedException('Fraza de confirmare este greșită.');
    }

    const companiesBefore = await this.prisma.company.count();
    this.logger.warn(
      `HARD RESET declanșat de PlatformAdmin ${adminEmail} (${adminId}) — se șterg ${companiesBefore} companii și toate datele lor.`,
    );

    const { count: deletedCompanies } = await TenantContext.runAsBypass(async () => {
      return await this.prisma.tenantScoped.company.deleteMany({});
    });

    this.logger.warn(`HARD RESET finalizat — ${deletedCompanies} companii șterse.`);
    return { deletedCompanies };
  }
}
