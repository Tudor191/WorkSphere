import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { ConflictException, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { GoogleProfile } from '../src/auth/strategies/google.strategy';
import { uniqueSuffix } from './helpers/company';

/**
 * Testează totul ce se poate testa fără un consimțământ real de Google:
 * `AuthService.loginWithGoogle`/`completeGoogleRegistration` primesc exact
 * profilul pe care Passport l-ar preda controller-ului după consimțământ —
 * pasul care lipsește (ecranul Google în sine) nu ține de codul nostru.
 */
describe('Autentificare prin Google (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;

  function fakeGoogleProfile(label: string): GoogleProfile {
    const suffix = uniqueSuffix();
    return {
      googleId: `google-${suffix}`,
      email: `${label}-${suffix}@e2e.ro`,
      firstName: 'Ana',
      lastName: label,
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    authService = app.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('un email fără cont existent primește un token temporar, nu un login direct', async () => {
    const profile = fakeGoogleProfile('NouGoogle');
    const result = await authService.loginWithGoogle(profile);
    expect(result.kind).toBe('needs_company_name');
    if (result.kind !== 'needs_company_name') throw new Error('unreachable');
    expect(typeof result.pendingSignupToken).toBe('string');
  });

  it('finalizarea înregistrării creează compania + contul Admin fără parolă, cu googleId setat', async () => {
    const profile = fakeGoogleProfile('CompanieGoogle');
    const pending = await authService.loginWithGoogle(profile);
    if (pending.kind !== 'needs_company_name') throw new Error('era de așteptat needs_company_name');

    const result = await authService.completeGoogleRegistration({
      token: pending.pendingSignupToken,
      companyName: `Compania ${profile.lastName}`,
    });
    expect(result.user.email).toBe(profile.email);
    expect(result.user.roleName).toBe('Admin');
    expect(typeof result.tokens.accessToken).toBe('string');
    // Fără parolă setată — UI-ul de ștergere cont trebuie să știe asta
    // (confirmare simplă "ești sigur?", nu cere o parolă inexistentă).
    expect(result.user.hasPassword).toBe(false);

    // Reautentificarea prin Google cu același email acum reușește direct
    // (contul există deja) — nu mai cere numele companiei a doua oară.
    const loginAgain = await authService.loginWithGoogle(profile);
    expect(loginAgain.kind).toBe('authenticated');
  });

  it('refuză finalizarea cu un token invalid/falsificat', async () => {
    await expect(
      authService.completeGoogleRegistration({ token: 'nu-e-un-jwt-valid', companyName: 'Oricine SRL' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refuză finalizarea a doua oară cu același token, dacă emailul a primit între timp un cont', async () => {
    const profile = fakeGoogleProfile('RaceCondition');
    const pending = await authService.loginWithGoogle(profile);
    if (pending.kind !== 'needs_company_name') throw new Error('era de așteptat needs_company_name');

    await authService.completeGoogleRegistration({
      token: pending.pendingSignupToken,
      companyName: 'Prima Companie SRL',
    });

    await expect(
      authService.completeGoogleRegistration({
        token: pending.pendingSignupToken,
        companyName: 'A Doua Companie SRL',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('leagă automat un cont deja existent (creat prin register clasic) la primul login prin Google cu același email', async () => {
    const suffix = uniqueSuffix();
    const email = `existent-${suffix}@e2e.ro`;
    await authService.register({
      companyName: `Existent ${suffix}`,
      firstName: 'Ion',
      lastName: 'Popescu',
      email,
      password: 'ParolaMea123!',
    });

    const profile: GoogleProfile = { googleId: `google-${suffix}`, email, firstName: 'Ion', lastName: 'Popescu' };
    const result = await authService.loginWithGoogle(profile);
    expect(result.kind).toBe('authenticated');
    if (result.kind !== 'authenticated') throw new Error('unreachable');
    expect(result.user.email).toBe(email);
    // Contul are parolă (creat prin register clasic) — legarea Google nu o elimină.
    expect(result.user.hasPassword).toBe(true);
  });
});
