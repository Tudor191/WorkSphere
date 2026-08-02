import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createEmployeeAccount, getRoleId, registerCompany, uniqueSuffix } from './helpers/company';

describe('Angajați + Departamente (e2e)', () => {
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

  it('crearea unui angajat generează un link de invitație (token de setare a parolei), valabil 7 zile', async () => {
    const { accessToken } = await registerCompany(app, 'EmpInvite');
    const roleId = await getRoleId(app, accessToken, 'EMPLOYEE');

    const empRes = await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        email: `invitat-${uniqueSuffix()}@e2e.ro`,
        firstName: 'Invitat',
        lastName: 'Nou',
        roleId,
        position: 'Tester',
        contractType: 'FULL_TIME',
        hireDate: '2026-01-01',
      })
      .expect(201);
    const userId = empRes.body.employee.user.id as string;

    const tokenRow = await prisma.runBypassingRls((tx) =>
      tx.passwordResetToken.findFirst({ where: { userId } }),
    );
    expect(tokenRow).not.toBeNull();
    expect(tokenRow?.usedAt).toBeNull();
    const daysUntilExpiry = (tokenRow!.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysUntilExpiry).toBeGreaterThan(6.9);
    expect(daysUntilExpiry).toBeLessThan(7.1);

    // Parola temporară rămâne funcțională ca fallback, indiferent de email.
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: empRes.body.employee.user.email, password: empRes.body.temporaryPassword })
      .expect(200);
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

  it('ștergerea definitivă reușește chiar dacă angajatul a trimis mesaje de chat și a creat task-uri (vezi ISSUES.md)', async () => {
    const { accessToken } = await registerCompany(app, 'HardDelContent');
    // Primul angajat creat devine "fondatorul" (nu poate fi demis de altcineva) —
    // folosim un al doilea, cu rol MANAGER (are `tasks:create`), ca țintă a testului.
    await createEmployeeAccount(app, accessToken);
    const target = await createEmployeeAccount(app, accessToken, 'MANAGER');

    // Angajatul creează conținut văzut/folosit de restul echipei.
    const channel = await request(app.getHttpServer())
      .post('/api/chat/channels')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `echipa-${uniqueSuffix()}` })
      .expect(201);
    const message = await request(app.getHttpServer())
      .post(`/api/chat/channels/${channel.body.id}/messages`)
      .set('Authorization', `Bearer ${target.accessToken}`)
      .send({ content: 'Un mesaj important' })
      .expect(201);

    const task = await request(app.getHttpServer())
      .post('/api/tasks')
      .set('Authorization', `Bearer ${target.accessToken}`)
      .send({ title: 'Task creat de angajatul care va fi șters' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/employees/${target.employeeId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    // Înainte de fix, asta pica cu 500 (constrângere de cheie externă).
    await request(app.getHttpServer())
      .delete(`/api/employees/${target.employeeId}/permanent`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    // Mesajul și task-ul rămân intacte pentru echipă — doar atribuirea dispare.
    const messages = await request(app.getHttpServer())
      .get(`/api/chat/channels/${channel.body.id}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const persistedMessage = messages.body.find((m: { id: string }) => m.id === message.body.id);
    expect(persistedMessage).toBeDefined();
    expect(persistedMessage.content).toBe('Un mesaj important');
    expect(persistedMessage.authorId).toBeNull();

    const persistedTask = await prisma.runBypassingRls((tx) =>
      tx.task.findUnique({ where: { id: task.body.id } }),
    );
    expect(persistedTask).not.toBeNull();
    expect(persistedTask?.createdById).toBeNull();
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
