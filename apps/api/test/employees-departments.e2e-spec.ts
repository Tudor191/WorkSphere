import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createEmployeeAccount, getRoleId, registerCompany, uniqueSuffix } from './helpers/company';

describe('Angajați + Departamente (e2e)', () => {
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

  it('permite ciclul complet: creează departament, adaugă angajat în el, editează, listează', async () => {
    const { accessToken } = await registerCompany(app, 'EmpDep');
    const employeeRoleId = await getRoleId(app, accessToken, 'EMPLOYEE');

    const deptRes = await request(app.getHttpServer())
      .post('/api/departments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Vânzări' })
      .expect(201);
    expect(deptRes.body.name).toBe('Vânzări');

    const empRes = await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: `ana-${uniqueSuffix()}@e2e.ro`,
        firstName: 'Ana',
        lastName: 'Pop',
        roleId: employeeRoleId,
        departmentId: deptRes.body.id,
        position: 'Consultant',
        contractType: 'FULL_TIME',
        hireDate: '2026-01-15',
      })
      .expect(201);
    expect(empRes.body.employee.employeeCode).toBe('EMP-0001');
    expect(typeof empRes.body.temporaryPassword).toBe('string');

    const employeeId = empRes.body.employee.id as string;
    const detail = await request(app.getHttpServer())
      .get(`/api/employees/${employeeId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(detail.body.department.id).toBe(deptRes.body.id);

    const updated = await request(app.getHttpServer())
      .patch(`/api/employees/${employeeId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ position: 'Consultant senior' })
      .expect(200);
    expect(updated.body.position).toBe('Consultant senior');

    const list = await request(app.getHttpServer())
      .get('/api/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);

    const deptDetail = await request(app.getHttpServer())
      .get(`/api/departments/${deptRes.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(deptDetail.body.employees).toHaveLength(1);
  });

  it('respinge crearea unui angajat cu un email deja folosit în companie', async () => {
    const { accessToken } = await registerCompany(app, 'EmpDup');
    const roleId = await getRoleId(app, accessToken, 'EMPLOYEE');
    const payload = {
      email: `duplicat-${uniqueSuffix()}@e2e.ro`,
      firstName: 'Ion',
      lastName: 'Ionescu',
      roleId,
      position: 'Tester',
      contractType: 'FULL_TIME',
      hireDate: '2026-01-01',
    };
    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(409);
  });

  it('blochează ștergerea unui departament care mai are angajați', async () => {
    const { accessToken } = await registerCompany(app, 'DepDel');
    const roleId = await getRoleId(app, accessToken, 'EMPLOYEE');
    const dept = await request(app.getHttpServer())
      .post('/api/departments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'IT' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: `dev-${uniqueSuffix()}@e2e.ro`,
        firstName: 'Dev',
        lastName: 'Op',
        roleId,
        departmentId: dept.body.id,
        position: 'Developer',
        contractType: 'FULL_TIME',
        hireDate: '2026-01-01',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/departments/${dept.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);
  });

  it('demiterea (soft-delete) suspendă contul dar păstrează fișa; ștergerea definitivă cere demitere întâi', async () => {
    const { accessToken } = await registerCompany(app, 'EmpRemove');
    const roleId = await getRoleId(app, accessToken, 'EMPLOYEE');

    // Primul angajat creat devine "fondatorul" companiei (vezi
    // employees.service.ts) — folosim un al doilea angajat pentru acest test,
    // ca să nu se lovească de protecția de fondator.
    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: `primul-${uniqueSuffix()}@e2e.ro`,
        firstName: 'Primul',
        lastName: 'Angajat',
        roleId,
        position: 'Fondator',
        contractType: 'FULL_TIME',
        hireDate: '2026-01-01',
      })
      .expect(201);

    const target = await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: `demis-${uniqueSuffix()}@e2e.ro`,
        firstName: 'De',
        lastName: 'Mis',
        roleId,
        position: 'Tester',
        contractType: 'FULL_TIME',
        hireDate: '2026-01-01',
      })
      .expect(201);
    const targetId = target.body.employee.id as string;

    // Ștergerea definitivă înainte de demitere e blocată.
    await request(app.getHttpServer())
      .delete(`/api/employees/${targetId}/permanent`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);

    await request(app.getHttpServer())
      .delete(`/api/employees/${targetId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    // Fișa rămâne vizibilă (istoric), doar contul e suspendat.
    const afterRemove = await request(app.getHttpServer())
      .get(`/api/employees/${targetId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(afterRemove.body.user.status).toBe('SUSPENDED');

    await request(app.getHttpServer())
      .delete(`/api/employees/${targetId}/permanent`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    // După ștergerea definitivă, fișa chiar dispare.
    await request(app.getHttpServer())
      .get(`/api/employees/${targetId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('protejează fondatorul companiei (primul angajat creat) de demitere de către alți utilizatori', async () => {
    const { accessToken } = await registerCompany(app, 'Founder');
    const roleId = await getRoleId(app, accessToken, 'EMPLOYEE');

    const founder = await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: `fondator-${uniqueSuffix()}@e2e.ro`,
        firstName: 'Fon',
        lastName: 'Dator',
        roleId,
        position: 'Fondator',
        contractType: 'FULL_TIME',
        hireDate: '2026-01-01',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/employees/${founder.body.employee.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('un manager cu permisiunea de demitere nu se poate demite pe el însuși', async () => {
    const { accessToken } = await registerCompany(app, 'SelfRemove');
    const manager = await createEmployeeAccount(app, accessToken, 'MANAGER');

    await request(app.getHttpServer())
      .delete(`/api/employees/${manager.employeeId}`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .expect(403);
  });

  it('izolează angajații și departamentele complet între două companii', async () => {
    const companyA = await registerCompany(app, 'IsoA');
    const companyB = await registerCompany(app, 'IsoB');
    const roleIdA = await getRoleId(app, companyA.accessToken, 'EMPLOYEE');

    const deptA = await request(app.getHttpServer())
      .post('/api/departments')
      .set('Authorization', `Bearer ${companyA.accessToken}`)
      .send({ name: 'Departament secret A' })
      .expect(201);
    const empA = await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${companyA.accessToken}`)
      .send({
        email: `secretA-${uniqueSuffix()}@e2e.ro`,
        firstName: 'Secret',
        lastName: 'A',
        roleId: roleIdA,
        departmentId: deptA.body.id,
        position: 'X',
        contractType: 'FULL_TIME',
        hireDate: '2026-01-01',
      })
      .expect(201);

    const employeesForB = await request(app.getHttpServer())
      .get('/api/employees')
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(200);
    expect(employeesForB.body).toEqual([]);
    const departmentsForB = await request(app.getHttpServer())
      .get('/api/departments')
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(200);
    expect(departmentsForB.body).toEqual([]);

    await request(app.getHttpServer())
      .get(`/api/employees/${empA.body.employee.id}`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/departments/${deptA.body.id}`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/employees/${empA.body.employee.id}`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .send({ position: 'Hijack' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/employees/${empA.body.employee.id}`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(404);
  });
});
