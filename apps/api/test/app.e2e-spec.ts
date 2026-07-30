// Vezi comentariul din `src/main.ts`: `@worksphere/database` își încarcă
// propriul `.env` (superuser, folosit doar pentru migrări) la require() —
// trebuie suprascris explicit înainte de orice alt import, altfel testele
// ar rula conectate ca superuser și RLS ar fi bypass-uit fără să observăm.
import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('WorkSphere API (e2e)', () => {
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

  function unique() {
    return Math.random().toString(36).slice(2, 10);
  }

  it('permite înregistrarea unei companii noi și returnează un access token', async () => {
    const suffix = unique();
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        companyName: `E2E Co ${suffix}`,
        firstName: 'Ana',
        lastName: 'Test',
        email: `ana-${suffix}@e2e.ro`,
        password: 'ParolaMea123!',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(`ana-${suffix}@e2e.ro`);
    expect(res.body.user.role).toBe('Admin');
  });

  it('respinge accesul la endpoint-uri protejate fără token', async () => {
    await request(app.getHttpServer()).get('/api/employees').expect(401);
  });

  it('respinge login cu parolă greșită', async () => {
    const suffix = unique();
    await request(app.getHttpServer()).post('/api/auth/register').send({
      companyName: `E2E Co ${suffix}`,
      firstName: 'Ana',
      lastName: 'Test',
      email: `ana-${suffix}@e2e.ro`,
      password: 'ParolaMea123!',
    });

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `ana-${suffix}@e2e.ro`, password: 'ParolaGresita123!' })
      .expect(401);
  });

  it('izolează datele complet între două companii (multi-tenant RLS)', async () => {
    const suffixA = unique();
    const suffixB = unique();

    const companyA = await request(app.getHttpServer()).post('/api/auth/register').send({
      companyName: `E2E Co A ${suffixA}`,
      firstName: 'Ana',
      lastName: 'A',
      email: `a-${suffixA}@e2e.ro`,
      password: 'ParolaMea123!',
    });
    const companyB = await request(app.getHttpServer()).post('/api/auth/register').send({
      companyName: `E2E Co B ${suffixB}`,
      firstName: 'Bogdan',
      lastName: 'B',
      email: `b-${suffixB}@e2e.ro`,
      password: 'ParolaMea123!',
    });

    // Compania A creează un departament.
    await request(app.getHttpServer())
      .post('/api/departments')
      .set('Authorization', `Bearer ${companyA.body.accessToken}`)
      .send({ name: 'Departament secret A' })
      .expect(201);

    // Compania B nu trebuie să-l vadă în lista proprie de departamente.
    const departmentsForB = await request(app.getHttpServer())
      .get('/api/departments')
      .set('Authorization', `Bearer ${companyB.body.accessToken}`)
      .expect(200);

    expect(departmentsForB.body).toEqual([]);
  });
});
