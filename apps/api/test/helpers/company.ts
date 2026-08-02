import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

export interface RegisteredCompany {
  accessToken: string;
  userId: string;
  suffix: string;
}

/** Înregistrează o companie nouă + primul cont Admin — folosit ca fixture în teste e2e. */
export async function registerCompany(app: INestApplication, label = 'Co'): Promise<RegisteredCompany> {
  const suffix = uniqueSuffix();
  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({
      companyName: `${label} ${suffix}`,
      firstName: 'Admin',
      lastName: label,
      email: `admin-${suffix}@e2e.ro`,
      password: 'ParolaMea123!',
    })
    .expect(201);
  return { accessToken: res.body.accessToken as string, userId: res.body.user.id as string, suffix };
}

/** Găsește ID-ul unui rol de sistem (ADMIN/MANAGER/HR/ACCOUNTANT/EMPLOYEE) din seed-ul companiei curente. */
export async function getRoleId(
  app: INestApplication,
  accessToken: string,
  systemKey: string,
): Promise<string> {
  const rolesRes = await request(app.getHttpServer())
    .get('/api/roles')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  const role = (rolesRes.body as Array<{ id: string; systemKey: string }>).find(
    (r) => r.systemKey === systemKey,
  );
  if (!role) throw new Error(`Rolul ${systemKey} nu a fost găsit în seed.`);
  return role.id;
}

export interface CreatedEmployee {
  accessToken: string;
  userId: string;
  employeeId: string;
  email: string;
  temporaryPassword: string;
}

/**
 * Adaugă un al doilea cont în aceeași companie ca `admin` — folosit pentru
 * scenarii care au nevoie de 2 useri din ACEEAȘI companie (ex. membru de
 * canal chat), spre deosebire de izolarea cross-tenant (care are nevoie de
 * 2 companii diferite). Implicit rol EMPLOYEE, dar poate fi suprascris
 * (ex. MANAGER, ca să testăm auto-demiterea).
 */
export async function createEmployeeAccount(
  app: INestApplication,
  adminAccessToken: string,
  systemKey = 'EMPLOYEE',
): Promise<CreatedEmployee> {
  const roleId = await getRoleId(app, adminAccessToken, systemKey);

  const suffix = uniqueSuffix();
  const email = `emp-${suffix}@e2e.ro`;
  const createRes = await request(app.getHttpServer())
    .post('/api/employees')
    .set('Authorization', `Bearer ${adminAccessToken}`)
    .send({
      email,
      firstName: 'Angajat',
      lastName: suffix,
      roleId,
      position: 'Tester',
      contractType: 'FULL_TIME',
      hireDate: '2026-01-01',
    })
    .expect(201);

  const loginRes = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: createRes.body.temporaryPassword })
    .expect(200);

  return {
    accessToken: loginRes.body.accessToken as string,
    userId: loginRes.body.user.id as string,
    employeeId: createRes.body.employee.id as string,
    email,
    temporaryPassword: createRes.body.temporaryPassword as string,
  };
}
