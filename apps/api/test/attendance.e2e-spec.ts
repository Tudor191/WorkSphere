import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createEmployeeAccount, registerCompany } from './helpers/company';

describe('Pontaj (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('permite ciclul complet: check-in, blochează un al doilea check-in activ, apoi check-out calculează orele', async () => {
    const admin = await registerCompany(app, 'AttFull');
    const employee = await createEmployeeAccount(app, admin.accessToken);

    const checkIn = await request(app.getHttpServer())
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({})
      .expect(201);
    expect(checkIn.body.checkOutAt).toBeNull();
    // Statusul (PRESENT/LATE) depinde de ora reală la care rulează testul
    // față de orarul companiei (09:00 implicit) — nu de logica pe care o
    // testăm aici, deci verificăm doar că e o valoare validă din enum.
    expect(['PRESENT', 'LATE']).toContain(checkIn.body.status);

    // Nu se poate face un al doilea check-in cât timp primul e încă deschis.
    await request(app.getHttpServer())
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({})
      .expect(409);

    const checkOut = await request(app.getHttpServer())
      .post('/api/attendance/check-out')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({})
      .expect(201);
    expect(checkOut.body.checkOutAt).not.toBeNull();
    expect(checkOut.body.workedMinutes).toBeGreaterThanOrEqual(0);
    // Testul rulează instant — mult sub orarul standard (9h) al companiei.
    expect(checkOut.body.overtimeMinutes).toBe(0);
  });

  it('check-out fără niciun check-in activ dă 404', async () => {
    const admin = await registerCompany(app, 'AttNoCheckin');
    const employee = await createEmployeeAccount(app, admin.accessToken);

    await request(app.getHttpServer())
      .post('/api/attendance/check-out')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({})
      .expect(404);
  });

  it('raportul lunar agregă corect zilele prezente per angajat', async () => {
    const admin = await registerCompany(app, 'AttReport');
    const employee = await createEmployeeAccount(app, admin.accessToken);

    await request(app.getHttpServer())
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/attendance/check-out')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({})
      .expect(201);

    const now = new Date();
    const report = await request(app.getHttpServer())
      .get('/api/attendance/report/monthly')
      .query({ year: now.getFullYear(), month: now.getMonth() + 1 })
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    const entry = report.body.find((r: { employeeId: string }) => r.employeeId === employee.employeeId);
    expect(entry).toBeDefined();
    expect(entry.daysPresent).toBe(1);
  });

  it('izolează complet pontajele între două companii', async () => {
    const companyA = await registerCompany(app, 'AttIsoA');
    const employeeA = await createEmployeeAccount(app, companyA.accessToken);
    const companyB = await registerCompany(app, 'AttIsoB');
    const employeeB = await createEmployeeAccount(app, companyB.accessToken);

    await request(app.getHttpServer())
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${employeeA.accessToken}`)
      .send({})
      .expect(201);

    const allForB = await request(app.getHttpServer())
      .get('/api/attendance')
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(200);
    expect(allForB.body).toEqual([]);

    const mineForB = await request(app.getHttpServer())
      .get('/api/attendance/mine')
      .set('Authorization', `Bearer ${employeeB.accessToken}`)
      .expect(200);
    expect(mineForB.body).toEqual([]);
  });
});
