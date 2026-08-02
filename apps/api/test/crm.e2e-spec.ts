import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { registerCompany } from './helpers/company';

describe('CRM — Clienți + Lead-uri (e2e)', () => {
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

  it('permite ciclul complet pentru clienți: creează, editează, listează', async () => {
    const { accessToken } = await registerCompany(app, 'Client');

    const client = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Acme SRL', cui: 'RO123456', email: 'contact@acme.ro' })
      .expect(201);
    expect(client.body.name).toBe('Acme SRL');

    await request(app.getHttpServer())
      .patch(`/api/clients/${client.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phone: '+40712345678' })
      .expect(200)
      .then((res) => expect(res.body.phone).toBe('+40712345678'));

    const list = await request(app.getHttpServer())
      .get('/api/clients')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('permite ciclul complet pentru lead-uri, inclusiv schimbarea statusului de pipeline', async () => {
    const { accessToken } = await registerCompany(app, 'Lead');

    const lead = await request(app.getHttpServer())
      .post('/api/leads')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Ion Popescu', companyName: 'Popescu SRL', valueCents: 500000 })
      .expect(201);
    expect(lead.body.status).toBe('NEW');

    await request(app.getHttpServer())
      .patch(`/api/leads/${lead.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'QUALIFIED' })
      .expect(200)
      .then((res) => expect(res.body.status).toBe('QUALIFIED'));

    await request(app.getHttpServer())
      .delete(`/api/leads/${lead.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    const list = await request(app.getHttpServer())
      .get('/api/leads')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(list.body).toEqual([]);
  });

  it('izolează clienții și lead-urile complet între două companii', async () => {
    const companyA = await registerCompany(app, 'CrmA');
    const companyB = await registerCompany(app, 'CrmB');

    const clientA = await request(app.getHttpServer())
      .post('/api/clients')
      .set('Authorization', `Bearer ${companyA.accessToken}`)
      .send({ name: 'Client secret A' })
      .expect(201);
    const leadA = await request(app.getHttpServer())
      .post('/api/leads')
      .set('Authorization', `Bearer ${companyA.accessToken}`)
      .send({ name: 'Lead secret A' })
      .expect(201);

    const clientsForB = await request(app.getHttpServer())
      .get('/api/clients')
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(200);
    expect(clientsForB.body).toEqual([]);

    await request(app.getHttpServer())
      .get(`/api/clients/${clientA.body.id}`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/leads/${leadA.body.id}`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .send({ status: 'WON' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/clients/${clientA.body.id}`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(404);
  });
});
