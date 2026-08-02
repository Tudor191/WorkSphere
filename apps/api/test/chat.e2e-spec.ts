import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createEmployeeAccount, registerCompany } from './helpers/company';

describe('Chat — canale + mesaje (e2e)', () => {
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

  it('permite crearea unui canal public și trimiterea/citirea mesajelor', async () => {
    const { accessToken } = await registerCompany(app, 'ChatPub');

    const channel = await request(app.getHttpServer())
      .post('/api/chat/channels')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'general' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/chat/channels/${channel.body.id}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ content: 'Salut echipă!' })
      .expect(201);

    const messages = await request(app.getHttpServer())
      .get(`/api/chat/channels/${channel.body.id}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(messages.body).toHaveLength(1);
    expect(messages.body[0].content).toBe('Salut echipă!');
  });

  it('respinge accesul unui non-membru la un canal privat, în aceeași companie', async () => {
    const admin = await registerCompany(app, 'ChatPriv');
    const outsider = await createEmployeeAccount(app, admin.accessToken);

    const channel = await request(app.getHttpServer())
      .post('/api/chat/channels')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'privat-conducere', isPrivate: true, memberIds: [admin.userId] })
      .expect(201);

    // Angajatul din aceeași companie, dar neinvitat, nu poate citi/scrie.
    await request(app.getHttpServer())
      .get(`/api/chat/channels/${channel.body.id}/messages`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/chat/channels/${channel.body.id}/messages`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ content: 'Încercare de acces' })
      .expect(403);

    // Canalul privat nici măcar nu apare în lista angajatului neinvitat.
    const channelsForOutsider = await request(app.getHttpServer())
      .get('/api/chat/channels')
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(200);
    expect(channelsForOutsider.body.find((c: { id: string }) => c.id === channel.body.id)).toBeUndefined();
  });

  it('izolează canalele și mesajele complet între două companii', async () => {
    const companyA = await registerCompany(app, 'ChatA');
    const companyB = await registerCompany(app, 'ChatB');

    const channelA = await request(app.getHttpServer())
      .post('/api/chat/channels')
      .set('Authorization', `Bearer ${companyA.accessToken}`)
      .send({ name: 'canal-secret-a' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/chat/channels/${channelA.body.id}/messages`)
      .set('Authorization', `Bearer ${companyA.accessToken}`)
      .send({ content: 'Mesaj secret A' })
      .expect(201);

    const channelsForB = await request(app.getHttpServer())
      .get('/api/chat/channels')
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(200);
    expect(channelsForB.body).toEqual([]);

    // Un canal public din altă companie tot trebuie să fie inaccesibil.
    await request(app.getHttpServer())
      .get(`/api/chat/channels/${channelA.body.id}/messages`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/chat/channels/${channelA.body.id}/messages`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .send({ content: 'Injectat din compania B' })
      .expect(404);
  });
});
