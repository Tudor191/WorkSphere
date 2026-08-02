import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { uniqueSuffix } from './helpers/company';

/**
 * `POST /auth/forgot-password` / `POST /auth/reset-password` nu expun
 * niciodată tokenul real (doar prin email, care nu se trimite în CI fără
 * cont Resend) — folosim `AuthService.forgotPassword` direct (întoarce
 * `resetUrl` STRICT pentru teste, vezi comentariul din auth.service.ts) ca
 * să extragem tokenul și să verificăm ciclul complet prin HTTP real de
 * acolo încolo, exact ca `auth-google.e2e-spec.ts`.
 */
describe('Resetare parolă (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;

  function extractToken(resetUrl: string): string {
    return new URL(resetUrl).searchParams.get('token')!;
  }

  async function registerWithPassword(label: string, password: string): Promise<{ email: string; refreshCookie: string }> {
    const suffix = uniqueSuffix();
    const email = `${label}-${suffix}@e2e.ro`;
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        companyName: `${label} ${suffix}`,
        firstName: 'Test',
        lastName: label,
        email,
        password,
      })
      .expect(201);
    const refreshCookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('refresh_token='),
    )!;
    return { email, refreshCookie };
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

  it('/auth/forgot-password răspunde mereu 204, chiar dacă emailul nu are cont', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: `nu-exista-${uniqueSuffix()}@e2e.ro` })
      .expect(204);
  });

  it('ciclul complet: cerere → token → parolă nouă → parola veche nu mai merge, cea nouă da', async () => {
    const oldPassword = 'ParolaVeche123!';
    const newPassword = 'ParolaNoua456!';
    const { email } = await registerWithPassword('Reset', oldPassword);

    const pending = await authService.forgotPassword({ email });
    expect(pending).not.toBeNull();
    const token = extractToken(pending!.resetUrl);

    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, newPassword })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: oldPassword })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: newPassword })
      .expect(200);
  });

  it('un token de resetare nu poate fi refolosit a doua oară', async () => {
    const { email } = await registerWithPassword('Reuse', 'ParolaVeche123!');

    const pending = await authService.forgotPassword({ email });
    const token = extractToken(pending!.resetUrl);

    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'PrimaParola123!' })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'ADouaParola123!' })
      .expect(401);
  });

  it('respinge un token invalid/inexistent', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token: 'token-care-nu-exista', newPassword: 'OricareParola123!' })
      .expect(401);
  });

  it('resetarea parolei revocă sesiunile existente (refresh token-ul vechi nu mai poate reînnoi)', async () => {
    const { email, refreshCookie } = await registerWithPassword('Revoke', 'ParolaVeche123!');

    const pending = await authService.forgotPassword({ email });
    const token = extractToken(pending!.resetUrl);
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'ParolaNouaSigura123!' })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(401);
  });
});
