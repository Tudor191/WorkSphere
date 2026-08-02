import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AuditLogEntity } from '../common/decorators/audit-log.decorator';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CompleteGoogleRegistrationDto } from './dto/complete-google-registration.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { GoogleProfile } from './strategies/google.strategy';

const REFRESH_COOKIE_NAME = 'refresh_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Înregistrează o companie nouă + primul cont Admin (trial 14 zile)' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { tokens, user } = await this.authService.register(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return this.toAuthResponse(tokens.accessToken, user);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentificare cu email + parolă' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { tokens, user } = await this.authService.login(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return this.toAuthResponse(tokens.accessToken, user);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Trimite un email de resetare a parolei, dacă emailul are un cont (răspuns identic indiferent de rezultat)',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Setează o parolă nouă folosind tokenul primit prin email' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reînnoiește access token-ul folosind refresh token-ul din cookie' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken) {
      throw new UnauthorizedException('Lipsește refresh token-ul.');
    }
    const tokens = await this.authService.refresh(rawToken);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deconectare — revocă refresh token-ul curent' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    res.clearCookie(REFRESH_COOKIE_NAME);
  }

  @Get('me')
  @ApiOperation({ summary: 'Profilul utilizatorului autentificat curent' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<AuthResponseDto['user']> {
    const profile = await this.authService.me(user.userId);
    return {
      id: profile.id,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      companyId: profile.companyId,
      companySlug: profile.companySlug,
      role: profile.roleName,
      mustChangePassword: profile.mustChangePassword,
      hasPassword: profile.hasPassword,
    };
  }

  @Patch('me')
  @AuditLogEntity('User')
  @ApiOperation({ summary: 'Actualizează profilul propriu (nume, email)' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthResponseDto['user']> {
    const profile = await this.authService.updateProfile(user.userId, dto);
    return {
      id: profile.id,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      companyId: profile.companyId,
      companySlug: profile.companySlug,
      role: profile.roleName,
      mustChangePassword: profile.mustChangePassword,
      hasPassword: profile.hasPassword,
    };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditLogEntity('User')
  @ApiOperation({ summary: 'Schimbă parola contului propriu (necesită parola curentă)' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(user.userId, dto);
  }

  @Post('set-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditLogEntity('User')
  @ApiOperation({
    summary: 'Setează parola proprie prima dată (înlocuiește parola temporară generată la creare)',
  })
  async setPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetPasswordDto,
  ): Promise<void> {
    await this.authService.setPassword(user.userId, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Șterge ireversibil contul propriu (sau, dacă e singurul cont din companie, toată compania)',
  })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ companyDeleted: boolean }> {
    const result = await this.authService.deleteOwnAccount(user.userId, dto);
    res.clearCookie(REFRESH_COOKIE_NAME);
    return result;
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Pornește flow-ul OAuth Google' })
  googleAuth() {
    // Handled by passport-google-oauth20 (redirect către Google).
  }

  /**
   * Spre deosebire de restul endpoint-urilor de auth, acesta e o navigare
   * reală de browser (redirect de la Google), nu un `fetch` din SPA — deci
   * NU poate întoarce JSON direct. Redirecționează fie spre `/dashboard`
   * (cookie-ul de refresh e deja setat, `AuthProvider` preia sesiunea
   * automat la încărcare — vezi efectul lui de bootstrap), fie, dacă
   * emailul nu are cont, spre pagina care cere numele companiei.
   */
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Callback OAuth Google — redirecționează spre frontend' })
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const profile = req.user as GoogleProfile;
    const result = await this.authService.loginWithGoogle(profile);
    const frontendUrl = this.config.get<string>('app.frontendUrl')!;

    if (result.kind === 'needs_company_name') {
      res.redirect(
        `${frontendUrl}/register/google?token=${encodeURIComponent(result.pendingSignupToken)}`,
      );
      return;
    }

    this.setRefreshCookie(res, result.tokens.refreshToken);
    res.redirect(`${frontendUrl}/dashboard`);
  }

  @Public()
  @Post('google/complete-registration')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Finalizează înregistrarea unei companii noi pornite prin Google (lipsea numele companiei)',
  })
  async completeGoogleRegistration(
    @Body() dto: CompleteGoogleRegistrationDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { tokens, user } = await this.authService.completeGoogleRegistration(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return this.toAuthResponse(tokens.accessToken, user);
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    const refreshTtlDays = this.config.get<number>('app.jwt.refreshTtlDays')!;
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: this.config.get<string>('app.nodeEnv') === 'production',
      sameSite: 'lax',
      maxAge: refreshTtlDays * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });
  }

  private toAuthResponse(
    accessToken: string,
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      phone: string | null;
      companyId: string;
      companySlug: string;
      roleName: string;
      mustChangePassword: boolean;
      hasPassword: boolean;
    },
  ): AuthResponseDto {
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        companyId: user.companyId,
        companySlug: user.companySlug,
        role: user.roleName,
        mustChangePassword: user.mustChangePassword,
        hasPassword: user.hasPassword,
      },
    };
  }
}
