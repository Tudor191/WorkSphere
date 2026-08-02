import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createEmployeeAccount, registerCompany, uniqueSuffix } from './helpers/company';

const ADMIN_PASSWORD = 'ParolaMea123!';

describe('Ștergere cont propriu (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('parolă greșită la ștergere e respinsă, contul rămâne intact', async () => {
    const admin = await registerCompany(app, 'DelWrongPwd');

    await request(app.getHttpServer())
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ password: 'ceva-gresit' })
      .expect(401);

    // Contul tot există și parola veche funcționează.
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `admin-${admin.suffix}@e2e.ro`, password: ADMIN_PASSWORD })
      .expect(200);
  });

  it('singurul cont din companie își șterge contul → toată compania e ștearsă ireversibil', async () => {
    const admin = await registerCompany(app, 'DelSolo');
    const email = `admin-${admin.suffix}@e2e.ro`;

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const companyId = me.body.companyId as string;

    const res = await request(app.getHttpServer())
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ password: ADMIN_PASSWORD })
      .expect(200);
    expect(res.body.companyDeleted).toBe(true);

    const company = await prisma.runBypassingRls((tx) => tx.company.findUnique({ where: { id: companyId } }));
    expect(company).toBeNull();

    // Login-ul vechi nu mai funcționează — nici contul, nici compania nu mai există.
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: ADMIN_PASSWORD })
      .expect(401);
  });

  it('singurul Administrator activ dintr-o companie cu colegi nu-și poate șterge contul', async () => {
    const admin = await registerCompany(app, 'DelSoleAdmin');
    await createEmployeeAccount(app, admin.accessToken); // acum mai există un coleg

    await request(app.getHttpServer())
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ password: ADMIN_PASSWORD })
      .expect(403);

    // Contul rămâne activ.
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `admin-${admin.suffix}@e2e.ro`, password: ADMIN_PASSWORD })
      .expect(200);
  });

  it('un angajat obișnuit își șterge contul → anonimizat definitiv, dar colegii și conținutul lor rămân neafectate', async () => {
    const admin = await registerCompany(app, 'DelEmployee');
    const employee = await createEmployeeAccount(app, admin.accessToken);
    const coworker = await createEmployeeAccount(app, admin.accessToken);

    const res = await request(app.getHttpServer())
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ password: employee.temporaryPassword })
      .expect(200);
    expect(res.body.companyDeleted).toBe(false);

    // Vechiul token nu mai poate fi folosit pentru autentificare.
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: employee.email, password: employee.temporaryPassword })
      .expect(401);

    // Rândul `User` există încă (anonimizat), nu a fost șters fizic — altfel
    // ar rupe referințe fără cascadă spre conținut creat de acest cont.
    const anonymized = await prisma.runBypassingRls((tx) =>
      tx.user.findUnique({ where: { id: employee.userId } }),
    );
    expect(anonymized).not.toBeNull();
    expect(anonymized?.status).toBe('SUSPENDED');
    expect(anonymized?.email).not.toBe(employee.email);
    expect(anonymized?.passwordHash).toBeNull();

    // Fișa HR a fost închisă (endDate setat), nu ștearsă.
    const anonymizedEmployee = await prisma.runBypassingRls((tx) =>
      tx.employee.findUnique({ where: { id: employee.employeeId } }),
    );
    expect(anonymizedEmployee?.endDate).not.toBeNull();

    // Colegul rămas nu e afectat deloc.
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: coworker.email, password: coworker.temporaryPassword })
      .expect(200);
  });

  it('un cont creat exclusiv prin Google (fără parolă) își poate șterge contul fără să trimită parolă', async () => {
    const admin = await registerCompany(app, 'DelGoogleOnly');
    const employee = await createEmployeeAccount(app, admin.accessToken);
    const coworker = await createEmployeeAccount(app, admin.accessToken);

    // Simulează un cont "doar Google": nicio parolă setată.
    await prisma.runBypassingRls((tx) =>
      tx.user.update({ where: { id: employee.userId }, data: { passwordHash: null, googleId: `g-${uniqueSuffix()}` } }),
    );

    const res = await request(app.getHttpServer())
      .delete('/api/auth/me')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({})
      .expect(200);
    expect(res.body.companyDeleted).toBe(false);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: coworker.email, password: coworker.temporaryPassword })
      .expect(200);
  });
});
