import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createEmployeeAccount, registerCompany } from './helpers/company';

interface LeaveType {
  id: string;
  name: string;
  defaultDaysPerYear: number | null;
}

async function getLeaveTypeByName(
  app: INestApplication,
  accessToken: string,
  name: string,
): Promise<LeaveType> {
  const res = await request(app.getHttpServer())
    .get('/api/leave-requests/types')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  const type = (res.body as LeaveType[]).find((t) => t.name === name);
  if (!type) throw new Error(`Tipul de concediu "${name}" nu a fost găsit în seed.`);
  return type;
}

describe('Cereri de concediu (e2e)', () => {
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

  it('la înregistrare, o companie nouă are cele 3 tipuri implicite de concediu', async () => {
    const { accessToken } = await registerCompany(app, 'LeaveTypes');
    const res = await request(app.getHttpServer())
      .get('/api/leave-requests/types')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const names = (res.body as LeaveType[]).map((t) => t.name).sort();
    expect(names).toEqual(['Concediu de odihnă', 'Concediu medical', 'Fără plată'].sort());
  });

  it('ciclul complet: creează cerere, aprobă, soldul de concediu se actualizează', async () => {
    const admin = await registerCompany(app, 'LeaveFull');
    const employee = await createEmployeeAccount(app, admin.accessToken);
    const vacation = await getLeaveTypeByName(app, admin.accessToken, 'Concediu de odihnă');

    const created = await request(app.getHttpServer())
      .post('/api/leave-requests')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ leaveTypeId: vacation.id, startDate: '2026-08-10', endDate: '2026-08-14' })
      .expect(201);
    expect(created.body.status).toBe('PENDING');
    expect(Number(created.body.daysCount)).toBe(5);

    const approved = await request(app.getHttpServer())
      .post(`/api/leave-requests/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(201);
    expect(approved.body.status).toBe('APPROVED');

    const balances = await request(app.getHttpServer())
      .get('/api/leave-requests/balances/mine')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    const vacationBalance = balances.body.find((b: { leaveTypeId: string }) => b.leaveTypeId === vacation.id);
    expect(Number(vacationBalance.usedDays)).toBe(5);
    expect(Number(vacationBalance.totalDays)).toBe(21);
  });

  it('respinge aprobarea unei cereri de concediu plătit care ar depăși plafonul anual', async () => {
    const admin = await registerCompany(app, 'LeaveOver');
    const employee = await createEmployeeAccount(app, admin.accessToken);
    const vacation = await getLeaveTypeByName(app, admin.accessToken, 'Concediu de odihnă');

    // Interval lung, cu mult mai multe zile lucrătoare decât plafonul de 21.
    const created = await request(app.getHttpServer())
      .post('/api/leave-requests')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ leaveTypeId: vacation.id, startDate: '2026-08-01', endDate: '2026-09-30' })
      .expect(201);
    expect(Number(created.body.daysCount)).toBeGreaterThan(21);

    await request(app.getHttpServer())
      .post(`/api/leave-requests/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(409);

    // Cererea rămâne PENDING — aprobarea eșuată nu trebuie să lase o stare parțială.
    const mine = await request(app.getHttpServer())
      .get('/api/leave-requests/mine')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    expect(mine.body[0].status).toBe('PENDING');
  });

  it('concediul medical (fără plafon configurat) se aprobă chiar și pentru un număr mare de zile — vezi ISSUES.md #26', async () => {
    const admin = await registerCompany(app, 'LeaveMedical');
    const employee = await createEmployeeAccount(app, admin.accessToken);
    const medical = await getLeaveTypeByName(app, admin.accessToken, 'Concediu medical');
    expect(medical.defaultDaysPerYear).toBeNull();

    const created = await request(app.getHttpServer())
      .post('/api/leave-requests')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ leaveTypeId: medical.id, startDate: '2026-08-01', endDate: '2026-09-30' })
      .expect(201);
    expect(Number(created.body.daysCount)).toBeGreaterThan(21);

    const approved = await request(app.getHttpServer())
      .post(`/api/leave-requests/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(201);
    expect(approved.body.status).toBe('APPROVED');
  });

  it('respingerea salvează motivul, iar cererile ne-pending nu mai pot fi respinse/aprobate din nou', async () => {
    const admin = await registerCompany(app, 'LeaveReject');
    const employee = await createEmployeeAccount(app, admin.accessToken);
    const vacation = await getLeaveTypeByName(app, admin.accessToken, 'Concediu de odihnă');

    const created = await request(app.getHttpServer())
      .post('/api/leave-requests')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ leaveTypeId: vacation.id, startDate: '2026-08-10', endDate: '2026-08-14' })
      .expect(201);

    const rejected = await request(app.getHttpServer())
      .post(`/api/leave-requests/${created.body.id}/reject`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ rejectionReason: 'Prea multe cereri simultan în echipă.' })
      .expect(201);
    expect(rejected.body.status).toBe('REJECTED');
    expect(rejected.body.rejectionReason).toBe('Prea multe cereri simultan în echipă.');

    await request(app.getHttpServer())
      .post(`/api/leave-requests/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/leave-requests/${created.body.id}/reject`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ rejectionReason: 'A doua respingere' })
      .expect(409);
  });

  it('un angajat poate anula propria cerere în așteptare, dar nu pe a altcuiva', async () => {
    const admin = await registerCompany(app, 'LeaveCancel');
    const employeeA = await createEmployeeAccount(app, admin.accessToken);
    const employeeB = await createEmployeeAccount(app, admin.accessToken);
    const vacation = await getLeaveTypeByName(app, admin.accessToken, 'Concediu de odihnă');

    const created = await request(app.getHttpServer())
      .post('/api/leave-requests')
      .set('Authorization', `Bearer ${employeeA.accessToken}`)
      .send({ leaveTypeId: vacation.id, startDate: '2026-08-10', endDate: '2026-08-14' })
      .expect(201);

    // B nu poate anula cererea lui A.
    await request(app.getHttpServer())
      .post(`/api/leave-requests/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${employeeB.accessToken}`)
      .expect(403);

    const canceled = await request(app.getHttpServer())
      .post(`/api/leave-requests/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${employeeA.accessToken}`)
      .expect(201);
    expect(canceled.body.status).toBe('CANCELED');

    // O cerere deja anulată nu mai poate fi anulată din nou.
    await request(app.getHttpServer())
      .post(`/api/leave-requests/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${employeeA.accessToken}`)
      .expect(409);
  });

  it('izolează complet cererile de concediu între două companii', async () => {
    const companyA = await registerCompany(app, 'LeaveIsoA');
    const employeeA = await createEmployeeAccount(app, companyA.accessToken);
    const vacationA = await getLeaveTypeByName(app, companyA.accessToken, 'Concediu de odihnă');
    const companyB = await registerCompany(app, 'LeaveIsoB');

    const created = await request(app.getHttpServer())
      .post('/api/leave-requests')
      .set('Authorization', `Bearer ${employeeA.accessToken}`)
      .send({ leaveTypeId: vacationA.id, startDate: '2026-08-10', endDate: '2026-08-14' })
      .expect(201);

    const listForB = await request(app.getHttpServer())
      .get('/api/leave-requests')
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(200);
    expect(listForB.body).toEqual([]);

    await request(app.getHttpServer())
      .post(`/api/leave-requests/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/leave-requests/${created.body.id}/reject`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .send({ rejectionReason: 'Încercare cross-tenant' })
      .expect(404);
  });
});
