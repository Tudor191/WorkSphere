import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmployeesService } from '../src/employees/employees.service';
import { AccountDeletionService } from '../src/account-deletion/account-deletion.service';
import { TenantContext } from '../src/common/tenant/tenant-context';
import { createEmployeeAccount, registerCompany } from './helpers/company';

/**
 * `EmployeesService.remove()` (demitere) nu se auto-împachetează în
 * `TenantContext.runAsBypass` (spre deosebire de `AuthService`) — rulează
 * normal sub contextul de tenant deja stabilit de request-ul HTTP. Ca să-l
 * apelăm direct dintr-un test (ca să extragem `deletionCode`, care nu e
 * niciodată expus prin HTTP — vezi doc-comentariul de pe `remove()`),
 * stabilim manual acel context, la fel cum ar face-o middleware-ul.
 */
describe('Ștergere automată/accelerată a conturilor demise (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let employeesService: EmployeesService;
  let accountDeletionService: AccountDeletionService;

  async function companyIdFor(accessToken: string): Promise<string> {
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    return me.body.companyId as string;
  }

  async function demite(
    adminAccessToken: string,
    adminUserId: string,
    employeeId: string,
  ): Promise<{ deletionCode: string | null }> {
    const companyId = await companyIdFor(adminAccessToken);
    return TenantContext.run(
      { companyId, userId: adminUserId, roleId: null, isPlatformBypass: false },
      () => employeesService.remove(employeeId, adminUserId),
    );
  }

  /**
   * Primul angajat creat într-o companie devine "fondatorul" (vezi
   * `EmployeesService.remove`) și nu poate fi demis de altcineva — creăm
   * mereu un angajat-fondator de umplutură întâi, ca angajatul real de test
   * să nu se lovească de acea protecție.
   */
  async function setupCompanyWithTarget(label: string) {
    const admin = await registerCompany(app, label);
    await createEmployeeAccount(app, admin.accessToken);
    const employee = await createEmployeeAccount(app, admin.accessToken);
    return { admin, employee };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    employeesService = app.get(EmployeesService);
    accountDeletionService = app.get(AccountDeletionService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('demiterea unui angajat programează ștergerea automată peste 7 zile și întoarce un cod de 6 cifre', async () => {
    const { admin, employee } = await setupCompanyWithTarget('SchedDel');

    const { deletionCode } = await demite(admin.accessToken, admin.userId, employee.employeeId);
    expect(deletionCode).toMatch(/^\d{6}$/);

    const requestRow = await prisma.runBypassingRls((tx) =>
      tx.accountDeletionRequest.findFirst({ where: { userId: employee.userId } }),
    );
    expect(requestRow).not.toBeNull();
    const daysUntilDeletion =
      (requestRow!.scheduledDeletionAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysUntilDeletion).toBeGreaterThan(6.9);
    expect(daysUntilDeletion).toBeLessThan(7.1);
  });

  it('o a doua demitere pe un cont deja suspendat nu generează un cod nou', async () => {
    const { admin, employee } = await setupCompanyWithTarget('SchedDelTwice');

    const first = await demite(admin.accessToken, admin.userId, employee.employeeId);
    expect(first.deletionCode).not.toBeNull();

    const second = await demite(admin.accessToken, admin.userId, employee.employeeId);
    expect(second.deletionCode).toBeNull();
  });

  it('confirmarea cu email + cod + parolă corecte șterge definitiv contul imediat', async () => {
    const { admin, employee } = await setupCompanyWithTarget('ConfirmDel');
    const { deletionCode } = await demite(admin.accessToken, admin.userId, employee.employeeId);

    await request(app.getHttpServer())
      .post('/api/account-deletion/confirm')
      .send({ email: employee.email, code: deletionCode, password: employee.temporaryPassword })
      .expect(204);

    const user = await prisma.runBypassingRls((tx) => tx.user.findUnique({ where: { id: employee.userId } }));
    expect(user).toBeNull();

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: employee.email, password: employee.temporaryPassword })
      .expect(401);
  });

  it('confirmarea cu cod, parolă sau email greșite e respinsă (401), contul rămâne intact', async () => {
    const { admin, employee } = await setupCompanyWithTarget('ConfirmDelWrong');
    const { deletionCode } = await demite(admin.accessToken, admin.userId, employee.employeeId);

    await request(app.getHttpServer())
      .post('/api/account-deletion/confirm')
      .send({ email: employee.email, code: '000000', password: employee.temporaryPassword })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/account-deletion/confirm')
      .send({ email: employee.email, code: deletionCode, password: 'parola-gresita-123' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/account-deletion/confirm')
      .send({ email: 'nu-exista@e2e.ro', code: deletionCode, password: employee.temporaryPassword })
      .expect(401);

    const user = await prisma.runBypassingRls((tx) => tx.user.findUnique({ where: { id: employee.userId } }));
    expect(user).not.toBeNull();

    // Încercarea corectă tot funcționează după cele greșite — nimic nu a fost corupt.
    await request(app.getHttpServer())
      .post('/api/account-deletion/confirm')
      .send({ email: employee.email, code: deletionCode, password: employee.temporaryPassword })
      .expect(204);
  });

  it('cron-ul zilnic șterge definitiv un cont a cărui perioadă de grație a expirat, fără accelerare', async () => {
    const { admin, employee } = await setupCompanyWithTarget('CronDel');
    await demite(admin.accessToken, admin.userId, employee.employeeId);

    // Simulează trecerea celor 7 zile.
    await prisma.runBypassingRls((tx) =>
      tx.accountDeletionRequest.updateMany({
        where: { userId: employee.userId },
        data: { scheduledDeletionAt: new Date(Date.now() - 1000) },
      }),
    );

    await accountDeletionService.processScheduledDeletions();

    const user = await prisma.runBypassingRls((tx) => tx.user.findUnique({ where: { id: employee.userId } }));
    expect(user).toBeNull();
  });

  it('cron-ul nu atinge conturile a căror perioadă de grație nu a expirat încă', async () => {
    const { admin, employee } = await setupCompanyWithTarget('CronDelNotYet');
    await demite(admin.accessToken, admin.userId, employee.employeeId);

    await accountDeletionService.processScheduledDeletions();

    const user = await prisma.runBypassingRls((tx) => tx.user.findUnique({ where: { id: employee.userId } }));
    expect(user).not.toBeNull();
  });
});
