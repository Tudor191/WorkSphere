import { randomBytes, createHash } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  DEFAULT_ROLE_PERMISSIONS,
  Prisma,
  SYSTEM_ROLES,
  type SystemRole,
} from '@worksphere/database';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { JwtAccessPayload } from './types/jwt-payload.type';
import { GoogleProfile } from './strategies/google.strategy';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 48;

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  companyId: string;
  companySlug: string;
  roleId: string;
  roleName: string;
  mustChangePassword: boolean;
}

/**
 * NOTĂ ARHITECTURALĂ: toată logica din acest service rulează sub
 * `TenantContext.runAsBypass(...)`. Login/register/refresh/Google OAuth
 * trebuie să caute un `User` după email sau un `RefreshToken` după hash
 * ÎNAINTE să existe vreun context de tenant stabilit (asta e literalmente
 * ce stabilesc), deci filtrarea RLS obișnuită (company_id = ...) nu se
 * poate aplica aici — vezi comentariul din `TenantContext.runAsBypass`.
 * Fiecare interogare sub bypass rămâne "narrow" (egalitate exactă pe email
 * unic global / hash de token unic global), niciodată o listă.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ tokens: IssuedTokens; user: AuthContextUser }> {
    return TenantContext.runAsBypass(() => this.doRegister(dto));
  }

  async login(dto: LoginDto): Promise<{ tokens: IssuedTokens; user: AuthContextUser }> {
    return TenantContext.runAsBypass(() => this.doLogin(dto));
  }

  async loginWithGoogle(
    profile: GoogleProfile,
  ): Promise<{ tokens: IssuedTokens; user: AuthContextUser }> {
    return TenantContext.runAsBypass(() => this.doLoginWithGoogle(profile));
  }

  async refresh(rawToken: string): Promise<IssuedTokens> {
    return TenantContext.runAsBypass(() => this.doRefresh(rawToken));
  }

  async logout(rawToken: string): Promise<void> {
    return TenantContext.runAsBypass(() => this.doLogout(rawToken));
  }

  /**
   * Profil complet pentru utilizatorul autentificat curent — spre
   * deosebire de payload-ul brut din JWT (`sub`/`companyId`/`roleId`),
   * folosit de UI pentru afișare (nume, rol, companie). Rulează cu
   * contextul de tenant deja stabilit de `TenantContextMiddleware` (nu
   * necesită bypass — e un request normal, autenticat).
   */
  async me(userId: string): Promise<AuthContextUser> {
    const user = await this.prisma.tenantScoped.user.findUniqueOrThrow({
      where: { id: userId },
      include: { company: true, role: true },
    });
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      companyId: user.companyId,
      companySlug: user.company.slug,
      roleId: user.roleId,
      roleName: user.role.name,
      mustChangePassword: user.mustChangePassword,
    };
  }

  /** Actualizează nume/email pentru contul autentificat curent (nu necesită parola). */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AuthContextUser> {
    try {
      const user = await this.prisma.tenantScoped.user.update({
        where: { id: userId },
        data: {
          ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        },
        include: { company: true, role: true },
      });
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        companyId: user.companyId,
        companySlug: user.company.slug,
        roleId: user.roleId,
        roleName: user.role.name,
        mustChangePassword: user.mustChangePassword,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Există deja un cont cu acest email.');
      }
      throw error;
    }
  }

  /** Schimbă parola contului autentificat curent — necesită parola curentă corectă. */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.tenantScoped.user.findUniqueOrThrow({ where: { id: userId } });
    const currentMatches = user.passwordHash
      ? await bcrypt.compare(dto.currentPassword, user.passwordHash)
      : false;
    if (!currentMatches) {
      throw new UnauthorizedException('Parola curentă este incorectă.');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.tenantScoped.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
  }

  /**
   * Ecranul obligatoriu de la prima autentificare cu o parolă temporară
   * generată random (vezi EmployeesService.create). Nu cere parola curentă
   * (utilizatorul tocmai s-a autentificat cu ea) — dar e utilizabil STRICT
   * cât timp `mustChangePassword` e true, ca să nu devină o cale ocolitoare
   * pentru schimbarea parolei fără a o cunoaște pe cea veche.
   */
  async setPassword(userId: string, dto: SetPasswordDto): Promise<void> {
    const user = await this.prisma.tenantScoped.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mustChangePassword) {
      throw new ForbiddenException(
        'Acest cont nu are o schimbare de parolă obligatorie — folosește schimbarea parolei din setările contului.',
      );
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.tenantScoped.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
  }

  private async doRegister(
    dto: RegisterDto,
  ): Promise<{ tokens: IssuedTokens; user: AuthContextUser }> {
    const existingUser = await this.prisma.tenantScoped.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Există deja un cont cu acest email.');
    }

    const slug = await this.generateUniqueSlug(dto.companyName);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const trialPlan = await this.prisma.subscriptionPlan.findUnique({ where: { slug: 'trial' } });
    const allPermissions = await this.prisma.permission.findMany();
    const permissionIdByKey = new Map(
      allPermissions.map((p) => [`${p.resource}:${p.action}`, p.id]),
    );
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { slug, name: dto.companyName, trialEndsAt },
      });

      // Din acest punct, orice INSERT în tabele [TENANT] trece prin RLS —
      // setăm contextul de tenant manual, o singură dată, pentru restul
      // acestei tranzacții (compania tocmai a fost creată, deci diferă de
      // bypass-ul de mai sus: aici știm exact compania țintă).
      await tx.$executeRaw`SELECT set_config('app.current_company_id', ${company.id}, TRUE)`;

      if (trialPlan) {
        await tx.subscription.create({
          data: {
            companyId: company.id,
            planId: trialPlan.id,
            status: 'TRIALING',
            billingCycle: 'MONTHLY',
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndsAt,
          },
        });
      }

      let adminRoleId = '';
      for (const systemKey of SYSTEM_ROLES) {
        const role = await tx.role.create({
          data: {
            companyId: company.id,
            name: systemKey.charAt(0) + systemKey.slice(1).toLowerCase(),
            systemKey,
            isSystem: true,
          },
        });
        if (systemKey === ('ADMIN' as SystemRole)) adminRoleId = role.id;

        const permissionIds = DEFAULT_ROLE_PERMISSIONS[systemKey as SystemRole]
          .map((key) => permissionIdByKey.get(key))
          .filter((id): id is string => Boolean(id));
        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
          });
        }
      }

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          roleId: adminRoleId,
          status: 'ACTIVE',
        },
      });

      // Tipuri de concediu implicite — fără ele, modulul de concedii e
      // inutilizabil imediat după înregistrare (nu există niciun
      // `leaveTypeId` valid de trimis la creare cerere).
      await tx.leaveType.createMany({
        data: [
          {
            companyId: company.id,
            name: 'Concediu de odihnă',
            colorHex: '#22c55e',
            isPaid: true,
            defaultDaysPerYear: 21,
          },
          { companyId: company.id, name: 'Concediu medical', colorHex: '#f59e0b', isPaid: true },
          { companyId: company.id, name: 'Fără plată', colorHex: '#6b7280', isPaid: false },
        ],
      });

      return { company, user, roleName: 'Admin' };
    });

    const tokens = await this.issueTokenPair({
      id: result.user.id,
      email: result.user.email,
      companyId: result.company.id,
      roleId: result.user.roleId,
    });

    return {
      tokens,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        phone: result.user.phone,
        companyId: result.company.id,
        companySlug: result.company.slug,
        roleId: result.user.roleId,
        roleName: result.roleName,
        mustChangePassword: result.user.mustChangePassword,
      },
    };
  }

  private async doLogin(dto: LoginDto): Promise<{ tokens: IssuedTokens; user: AuthContextUser }> {
    const user = await this.prisma.tenantScoped.user.findUnique({
      where: { email: dto.email },
      include: { company: true, role: true },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email sau parolă incorectă.');
    }
    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Email sau parolă incorectă.');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Contul nu este activ. Contactează administratorul companiei.',
      );
    }

    await this.prisma.tenantScoped.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokenPair({
      id: user.id,
      email: user.email,
      companyId: user.companyId,
      roleId: user.roleId,
    });

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        companyId: user.companyId,
        companySlug: user.company.slug,
        roleId: user.roleId,
        roleName: user.role.name,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  private async doLoginWithGoogle(
    profile: GoogleProfile,
  ): Promise<{ tokens: IssuedTokens; user: AuthContextUser }> {
    let user = await this.prisma.tenantScoped.user.findUnique({
      where: { email: profile.email },
      include: { company: true, role: true },
    });

    if (!user) {
      // Nu există invitație/cont pentru acest email — pentru v1 refuzăm
      // auto-crearea unei companii noi prin Google (ar ocoli fluxul de
      // trial/onboarding din `register`). Un utilizator invitat de un
      // Admin de companie ar trebui să existe deja cu `status: INVITED`.
      throw new UnauthorizedException(
        'Nu există niciun cont asociat acestui email. Cere o invitație de la administratorul companiei.',
      );
    }

    if (!user.googleId) {
      user = await this.prisma.tenantScoped.user.update({
        where: { id: user.id },
        data: { googleId: profile.googleId, status: 'ACTIVE' },
        include: { company: true, role: true },
      });
    }

    const tokens = await this.issueTokenPair({
      id: user.id,
      email: user.email,
      companyId: user.companyId,
      roleId: user.roleId,
    });

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        companyId: user.companyId,
        companySlug: user.company.slug,
        roleId: user.roleId,
        roleName: user.role.name,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  private async doRefresh(rawToken: string): Promise<IssuedTokens> {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.tenantScoped.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Sesiune expirată. Autentifică-te din nou.');
    }

    if (stored.revokedAt) {
      // Refresh token reutilizat după ce a fost deja rotit — semn de furt.
      // Revocăm toate sesiunile utilizatorului ca măsură de precauție.
      this.logger.warn(
        `Refresh token reutilizat pentru user ${stored.userId} — revoc toate sesiunile.`,
      );
      await this.prisma.tenantScoped.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Sesiune invalidă. Autentifică-te din nou.');
    }

    const newTokens = await this.issueTokenPair({
      id: stored.user.id,
      email: stored.user.email,
      companyId: stored.user.companyId,
      roleId: stored.user.roleId,
    });

    const newTokenHash = this.hashToken(newTokens.refreshToken);
    const newRecord = await this.prisma.tenantScoped.refreshToken.findUnique({
      where: { tokenHash: newTokenHash },
    });
    await this.prisma.tenantScoped.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedByTokenId: newRecord?.id },
    });

    return newTokens;
  }

  private async doLogout(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.tenantScoped.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokenPair(user: {
    id: string;
    email: string;
    companyId: string;
    roleId: string;
  }): Promise<IssuedTokens> {
    const payload: JwtAccessPayload = {
      sub: user.id,
      companyId: user.companyId,
      roleId: user.roleId,
      email: user.email,
    };
    const accessToken = this.jwt.sign(payload);

    const rawRefreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const refreshTtlDays = this.config.get<number>('app.jwt.refreshTtlDays')!;
    await this.prisma.tenantScoped.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private async generateUniqueSlug(companyName: string): Promise<string> {
    const base =
      companyName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 50) || 'companie';

    let candidate = base;
    let attempt = 0;
    while (await this.prisma.company.findUnique({ where: { slug: candidate } })) {
      attempt += 1;
      candidate = `${base}-${randomBytes(2).toString('hex')}`;
      if (attempt > 5) break;
    }
    return candidate;
  }
}
