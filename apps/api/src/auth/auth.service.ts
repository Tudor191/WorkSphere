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
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CompleteGoogleRegistrationDto } from './dto/complete-google-registration.dto';
import { GoogleSignupPendingPayload, JwtAccessPayload } from './types/jwt-payload.type';
import { GoogleProfile } from './strategies/google.strategy';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 48;
const GOOGLE_SIGNUP_TOKEN_TTL = '10m';
const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 oră

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

type AuthResult = { tokens: IssuedTokens; user: AuthContextUser };

/**
 * Rezultatul unei încercări de login prin Google: fie un cont autentificat
 * direct (existent, sau tocmai legat de acest googleId), fie — dacă emailul
 * nu are niciun cont — un semnal că mai lipsește un singur pas: numele
 * companiei (Google nu-l poate furniza). `pendingSignupToken` cară profilul
 * Google verificat până la acel pas final (`completeGoogleRegistration`).
 */
type GoogleAuthResult =
  | ({ kind: 'authenticated' } & AuthResult)
  | { kind: 'needs_company_name'; pendingSignupToken: string };

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
  // Secret DERIVAT din `accessSecret`, NU cel folosit direct de tokenurile
  // de acces normale — separare criptografică deliberată, ca un
  // `pendingSignupToken` să nu poată fi niciodată verificat cu succes de
  // `JwtStrategy`/`TenantContextMiddleware` (care folosesc secretul de bază),
  // indiferent cum ar ajunge din greșeală într-un header `Authorization`.
  // Vezi comentariul din `GoogleSignupPendingPayload`.
  private readonly googleSignupSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {
    this.googleSignupSecret = `${this.config.get<string>('app.jwt.accessSecret')}::google-signup-pending`;
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    return TenantContext.runAsBypass(() => this.doRegister(dto));
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    return TenantContext.runAsBypass(() => this.doLogin(dto));
  }

  async loginWithGoogle(profile: GoogleProfile): Promise<GoogleAuthResult> {
    return TenantContext.runAsBypass(() => this.doLoginWithGoogle(profile));
  }

  async completeGoogleRegistration(dto: CompleteGoogleRegistrationDto): Promise<AuthResult> {
    return TenantContext.runAsBypass(() => this.doCompleteGoogleRegistration(dto));
  }

  /**
   * Întoarce `{ resetUrl }` (null dacă emailul nu are cont) — folosit intern
   * de teste, ca să poată verifica ciclul complet de resetare fără un cont
   * Resend real. Controller-ul HTTP ignoră deliberat valoarea întoarsă:
   * răspunsul către clientul real rămâne 204 necondiționat, indiferent de
   * rezultat (vezi comentariul de pe `doForgotPassword`).
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ resetUrl: string } | null> {
    return TenantContext.runAsBypass(() => this.doForgotPassword(dto));
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    return TenantContext.runAsBypass(() => this.doResetPassword(dto));
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

  private async doRegister(dto: RegisterDto): Promise<AuthResult> {
    const existingUser = await this.prisma.tenantScoped.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Există deja un cont cu acest email.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.createCompanyWithAdmin({
      companyName: dto.companyName,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      passwordHash,
    });
  }

  /**
   * Creează o companie nouă + primul cont Admin (roluri/permisiuni
   * standard, trial 14 zile, tipuri de concediu implicite) — folosit atât
   * de înregistrarea clasică (`doRegister`, cu parolă) cât și de
   * înregistrarea prin Google (`doCompleteGoogleRegistration`, fără
   * parolă, cu `googleId`). `passwordHash: null` + `googleId` setat =
   * cont utilizabil STRICT prin "Continuă cu Google" (vezi comentariul
   * câmpului `passwordHash` din schema Prisma).
   */
  private async createCompanyWithAdmin(input: {
    companyName: string;
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string | null;
    googleId?: string;
  }): Promise<AuthResult> {
    const slug = await this.generateUniqueSlug(input.companyName);
    const trialPlan = await this.prisma.subscriptionPlan.findUnique({ where: { slug: 'trial' } });
    const allPermissions = await this.prisma.permission.findMany();
    const permissionIdByKey = new Map(
      allPermissions.map((p) => [`${p.resource}:${p.action}`, p.id]),
    );
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { slug, name: input.companyName, trialEndsAt },
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
          email: input.email,
          passwordHash: input.passwordHash,
          googleId: input.googleId,
          firstName: input.firstName,
          lastName: input.lastName,
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

    // Bonus, nu condiție de succes a înregistrării — `sendWelcomeEmail`
    // înghite propriile erori (vezi EmailService), nu poate strica flow-ul.
    await this.email.sendWelcomeEmail({
      to: result.user.email,
      firstName: result.user.firstName,
      companyName: result.company.name,
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

  private async doLogin(dto: LoginDto): Promise<AuthResult> {
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

  private async doLoginWithGoogle(profile: GoogleProfile): Promise<GoogleAuthResult> {
    let user = await this.prisma.tenantScoped.user.findUnique({
      where: { email: profile.email },
      include: { company: true, role: true },
    });

    if (!user) {
      // Nu există niciun cont pentru acest email — spre deosebire de
      // designul inițial (care refuza), acum permitem înregistrarea unei
      // companii noi prin Google. Nu o putem crea AICI: Google nu ne dă un
      // nume de companie, deci mai lipsește un pas — vezi
      // `completeGoogleRegistration`. Profilul verificat de Google e cărat
      // mai departe într-un token semnat, nu ținut în sesiune server-side.
      const pendingSignupToken = await this.signGoogleSignupToken(profile);
      return { kind: 'needs_company_name', pendingSignupToken };
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
      kind: 'authenticated',
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

  /**
   * Al doilea (și ultim) pas al înregistrării prin Google — primește doar
   * numele companiei, restul profilului vine din tokenul semnat la pasul
   * anterior (`doLoginWithGoogle`). Verifică din nou (posibilă condiție de
   * cursă) că nu a apărut între timp un cont cu acest email — ex. cineva a
   * primit o invitație chiar în intervalul în care completa acest formular.
   */
  private async doCompleteGoogleRegistration(
    dto: CompleteGoogleRegistrationDto,
  ): Promise<AuthResult> {
    let payload: GoogleSignupPendingPayload;
    try {
      payload = await this.jwt.verifyAsync<GoogleSignupPendingPayload>(dto.token, {
        secret: this.googleSignupSecret,
      });
    } catch {
      throw new UnauthorizedException(
        'Linkul de înregistrare cu Google a expirat sau este invalid. Reia procesul de la Continuă cu Google.',
      );
    }
    if (payload.purpose !== 'google_signup') {
      throw new UnauthorizedException('Token invalid.');
    }

    const existingUser = await this.prisma.tenantScoped.user.findUnique({
      where: { email: payload.email },
    });
    if (existingUser) {
      throw new ConflictException(
        'Există deja un cont cu acest email — folosește Continuă cu Google din pagina de autentificare.',
      );
    }

    return this.createCompanyWithAdmin({
      companyName: dto.companyName,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      passwordHash: null,
      googleId: payload.googleId,
    });
  }

  private async signGoogleSignupToken(profile: GoogleProfile): Promise<string> {
    const payload: GoogleSignupPendingPayload = {
      purpose: 'google_signup',
      googleId: profile.googleId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
    };
    return this.jwt.signAsync(payload, {
      secret: this.googleSignupSecret,
      expiresIn: GOOGLE_SIGNUP_TOKEN_TTL,
    });
  }

  /**
   * Răspunsul e IDENTIC indiferent dacă emailul are sau nu un cont — altfel
   * endpoint-ul ar deveni un oracol pentru "ce emailuri sunt înregistrate
   * pe WorkSphere" (enumerare de conturi). Dacă există un cont, se
   * generează un token cu durată scurtă și se trimite pe email; dacă nu,
   * pur și simplu nu se întâmplă nimic vizibil din exterior.
   */
  private async doForgotPassword(dto: ForgotPasswordDto): Promise<{ resetUrl: string } | null> {
    const user = await this.prisma.tenantScoped.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) return null;

    const rawToken = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('hex');
    await this.prisma.tenantScoped.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    const frontendUrl = this.config.get<string>('app.frontendUrl');
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
    await this.email.sendPasswordResetEmail({
      to: user.email,
      firstName: user.firstName,
      resetUrl,
      expiresInMinutes: PASSWORD_RESET_TTL_MS / 60_000,
    });
    return { resetUrl };
  }

  /**
   * Setează parola nouă și, ca măsură de securitate, revocă TOATE sesiunile
   * active (refresh tokens) ale contului — dacă cineva a resetat parola
   * pentru că vechea parolă era compromisă, orice sesiune deja deschisă cu
   * acea parolă (ex. pe un dispozitiv furat) trebuie să moară imediat, nu
   * doar cea curentă.
   */
  private async doResetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = this.hashToken(dto.token);
    const stored = await this.prisma.tenantScoped.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Linkul de resetare a parolei a expirat sau este invalid. Cere unul nou.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.tenantScoped.user.update({
      where: { id: stored.userId },
      data: { passwordHash, mustChangePassword: false },
    });
    await this.prisma.tenantScoped.passwordResetToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    });
    await this.prisma.tenantScoped.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
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
