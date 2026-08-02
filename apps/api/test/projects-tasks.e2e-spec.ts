import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { registerCompany } from './helpers/company';

describe('Proiecte + Task-uri (e2e)', () => {
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

  it('permite ciclul complet: creează proiect, adaugă task, editează status, listează', async () => {
    const { accessToken } = await registerCompany(app, 'Proj');

    const projectRes = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Website nou', description: 'Refacere site' })
      .expect(201);
    expect(projectRes.body.name).toBe('Website nou');

    const taskRes = await request(app.getHttpServer())
      .post('/api/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Configurare staging', projectId: projectRes.body.id })
      .expect(201);
    expect(taskRes.body.status).toBe('TODO');

    await request(app.getHttpServer())
      .patch(`/api/tasks/${taskRes.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200)
      .then((res) => expect(res.body.status).toBe('IN_PROGRESS'));

    const projectDetail = await request(app.getHttpServer())
      .get(`/api/projects/${projectRes.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(projectDetail.body.tasks).toHaveLength(1);
    expect(projectDetail.body.tasks[0].id).toBe(taskRes.body.id);
  });

  it('blochează ștergerea unui proiect care are task-uri asociate', async () => {
    const { accessToken } = await registerCompany(app, 'ProjDel');
    const project = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Proiect cu task-uri' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/tasks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Task blocant', projectId: project.body.id })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/projects/${project.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);
  });

  it('izolează proiectele și task-urile complet între două companii', async () => {
    const companyA = await registerCompany(app, 'ProjA');
    const companyB = await registerCompany(app, 'ProjB');

    const projectA = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${companyA.accessToken}`)
      .send({ name: 'Proiect secret A' })
      .expect(201);
    const taskA = await request(app.getHttpServer())
      .post('/api/tasks')
      .set('Authorization', `Bearer ${companyA.accessToken}`)
      .send({ title: 'Task secret A', projectId: projectA.body.id })
      .expect(201);

    // Lista din B nu conține nimic din A.
    const projectsForB = await request(app.getHttpServer())
      .get('/api/projects')
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(200);
    expect(projectsForB.body).toEqual([]);

    // Acces direct pe ID-ul din A, cu tokenul lui B — 404, nu datele reale.
    await request(app.getHttpServer())
      .get(`/api/projects/${projectA.body.id}`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/tasks/${taskA.body.id}`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(404);

    // B nu poate nici edita, nici șterge resursele lui A.
    await request(app.getHttpServer())
      .patch(`/api/projects/${projectA.body.id}`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .send({ name: 'Hijack' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/tasks/${taskA.body.id}`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(404);
  });
});
