import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { createEmployeeAccount, registerCompany, uniqueSuffix } from './helpers/company';

/**
 * Export/ștergere de date la nivel de companie (GDPR — portabilitate +
 * drept la ștergere), inițiate de propriul Admin din Setări — distincte de
 * `account-deletion.e2e-spec.ts` (ștergerea contului PROPRIU al unui
 * angajat) și de fluxul PlatformAdmin (`/dev`), care rezolvă aceeași nevoie
 * dar doar din panoul de platformă.
 */
describe('Export/ștergere GDPR a companiei curente (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('un Admin poate exporta toate datele companiei, într-un JSON care include angajați, roluri și task-uri', async () => {
    const admin = await registerCompany(app, 'ExportOk');
    const employee = await createEmployeeAccount(app, admin.accessToken);

    const res = await request(app.getHttpServer())
      .get('/api/companies/me/export')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(res.body.company).toBeTruthy();
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.some((u: { id: string }) => u.id === employee.userId)).toBe(true);
    expect(Array.isArray(res.body.roles)).toBe(true);
    expect(Array.isArray(res.body.employees)).toBe(true);
    // Nu expune niciodată hash-uri/secrete în export.
    expect(res.body.users[0].passwordHash).toBeUndefined();
  });

  it('un angajat obișnuit (fără permisiunea company:export) nu poate exporta datele companiei', async () => {
    const admin = await registerCompany(app, 'ExportForbidden');
    const employee = await createEmployeeAccount(app, admin.accessToken);

    await request(app.getHttpServer())
      .get('/api/companies/me/export')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(403);
  });

  it('un angajat obișnuit (fără permisiunea company:delete) nu poate șterge compania', async () => {
    const admin = await registerCompany(app, 'DeleteForbidden');
    const employee = await createEmployeeAccount(app, admin.accessToken);

    await request(app.getHttpServer())
      .delete('/api/companies/me')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({})
      .expect(403);
  });

  it('ștergerea companiei cu parolă greșită e respinsă (401), compania rămâne intactă', async () => {
    const admin = await registerCompany(app, 'DeleteWrongPw');
    await createEmployeeAccount(app, admin.accessToken);

    await request(app.getHttpServer())
      .delete('/api/companies/me')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ password: 'parola-gresita-123' })
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
  });

  it('un Admin cu parolă poate șterge definitiv compania și pe toți colegii ei (cascadă)', async () => {
    const admin = await registerCompany(app, 'DeleteOk');
    const employee = await createEmployeeAccount(app, admin.accessToken);

    const res = await request(app.getHttpServer())
      .delete('/api/companies/me')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ password: 'ParolaMea123!' })
      .expect(200);

    expect(typeof res.body.deletedCompanyId).toBe('string');

    const adminUser = await prisma.runBypassingRls((tx) =>
      tx.user.findUnique({ where: { id: admin.userId } }),
    );
    expect(adminUser).toBeNull();
    const employeeUser = await prisma.runBypassingRls((tx) =>
      tx.user.findUnique({ where: { id: employee.userId } }),
    );
    expect(employeeUser).toBeNull();
    const company = await prisma.runBypassingRls((tx) =>
      tx.company.findUnique({ where: { id: res.body.deletedCompanyId } }),
    );
    expect(company).toBeNull();
  });

  it('un Admin creat exclusiv prin Google (fără parolă) șterge compania cu o simplă confirmare, fără parolă', async () => {
    const suffix = uniqueSuffix();
    const pending = await authService.loginWithGoogle({
      googleId: `google-${suffix}`,
      email: `google-admin-${suffix}@e2e.ro`,
      firstName: 'Ana',
      lastName: 'Google',
    });
    if (pending.kind !== 'needs_company_name') throw new Error('era de așteptat needs_company_name');
    const registered = await authService.completeGoogleRegistration({
      token: pending.pendingSignupToken,
      companyName: `Compania Google ${suffix}`,
    });
    expect(registered.user.hasPassword).toBe(false);

    const res = await request(app.getHttpServer())
      .delete('/api/companies/me')
      .set('Authorization', `Bearer ${registered.tokens.accessToken}`)
      .send({})
      .expect(200);
    expect(typeof res.body.deletedCompanyId).toBe('string');

    const adminUser = await prisma.runBypassingRls((tx) =>
      tx.user.findUnique({ where: { id: registered.user.id } }),
    );
    expect(adminUser).toBeNull();
  });
});
