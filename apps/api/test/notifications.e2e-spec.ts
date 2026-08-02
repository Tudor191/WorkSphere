import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createEmployeeAccount, registerCompany, uniqueSuffix } from './helpers/company';

describe('Notificări (e2e)', () => {
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

  it('preferințele implicite sunt chat=activat, sms=dezactivat, și pot fi actualizate parțial', async () => {
    const { accessToken } = await registerCompany(app, 'PrefNotif');

    const initial = await request(app.getHttpServer())
      .get('/api/notifications/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(initial.body.chatNotificationsEnabled).toBe(true);
    expect(initial.body.smsNotificationsEnabled).toBe(false);

    const updated = await request(app.getHttpServer())
      .patch('/api/notifications/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ chatNotificationsEnabled: false })
      .expect(200);
    expect(updated.body.chatNotificationsEnabled).toBe(false);
    // smsNotificationsEnabled nu a fost trimis — trebuie să rămână neschimbat.
    expect(updated.body.smsNotificationsEnabled).toBe(false);
  });

  it('un mesaj de chat generează o notificare pentru celălalt membru al canalului, dar nu și pentru autor', async () => {
    const admin = await registerCompany(app, 'NotifChat');
    const employee = await createEmployeeAccount(app, admin.accessToken);

    const channel = await request(app.getHttpServer())
      .post('/api/chat/channels')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'echipa', isPrivate: true, memberIds: [admin.userId, employee.userId] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/chat/channels/${channel.body.id}/messages`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ content: 'Bună, cineva?' })
      .expect(201);

    const adminNotifications = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(adminNotifications.body.some((n: { type: string }) => n.type === 'chat_message')).toBe(true);

    // Autorul mesajului nu se notifică singur.
    const employeeNotifications = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    expect(employeeNotifications.body.some((n: { type: string }) => n.type === 'chat_message')).toBe(false);
  });

  it('dezactivarea comutatorului de chat oprește notificările viitoare de chat pentru acel user', async () => {
    const admin = await registerCompany(app, 'NotifOff');
    const employee = await createEmployeeAccount(app, admin.accessToken);

    await request(app.getHttpServer())
      .patch('/api/notifications/preferences')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ chatNotificationsEnabled: false })
      .expect(200);

    const channel = await request(app.getHttpServer())
      .post('/api/chat/channels')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'echipa-tacuta', isPrivate: true, memberIds: [admin.userId, employee.userId] })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/chat/channels/${channel.body.id}/messages`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ content: 'Ar trebui să nu ajungă notificare' })
      .expect(201);

    const adminNotifications = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(adminNotifications.body.some((n: { type: string }) => n.type === 'chat_message')).toBe(false);
  });

  it('marcarea ca citit scade contorul de necitite și afectează doar propriile notificări', async () => {
    const admin = await registerCompany(app, 'NotifRead');
    const employee = await createEmployeeAccount(app, admin.accessToken);
    const channel = await request(app.getHttpServer())
      .post('/api/chat/channels')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'echipa-read', isPrivate: true, memberIds: [admin.userId, employee.userId] })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/chat/channels/${channel.body.id}/messages`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ content: 'Mesaj de test' })
      .expect(201);

    const before = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(before.body.count).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post('/api/notifications/read-all')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(204);

    const after = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(after.body.count).toBe(0);

    // "Marchează tot citit" nu trebuie să afecteze notificările altui user.
    const employeeUnread = await request(app.getHttpServer())
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(200);
    expect(employeeUnread.body.count).toBe(0);
  });

  it('nu poți marca drept citită o notificare a altui user prin ghicirea ID-ului', async () => {
    const admin = await registerCompany(app, 'NotifCross');
    const employee = await createEmployeeAccount(app, admin.accessToken);
    const channel = await request(app.getHttpServer())
      .post('/api/chat/channels')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'echipa-cross', isPrivate: true, memberIds: [admin.userId, employee.userId] })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/chat/channels/${channel.body.id}/messages`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ content: 'Mesaj pentru admin' })
      .expect(201);

    const adminNotifications = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    const notificationId = adminNotifications.body[0].id;

    // Angajatul încearcă să marcheze ca citită o notificare care aparține adminului.
    await request(app.getHttpServer())
      .patch(`/api/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(404);
  });

  it('înregistrarea unui device token nou funcționează, iar re-înregistrarea aceluiași token de către același user (update) nu eșuează', async () => {
    const { accessToken } = await registerCompany(app, 'DeviceNew');
    const fcmToken = `fcm-${uniqueSuffix()}`;

    await request(app.getHttpServer())
      .post('/api/notifications/device-tokens')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fcmToken, platform: 'web' })
      .expect(204);

    // Re-înregistrare (ex: refresh de token FCM) — nu trebuie să eșueze.
    await request(app.getHttpServer())
      .post('/api/notifications/device-tokens')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fcmToken, platform: 'web' })
      .expect(204);
  });

  it('un fcmToken se poate realoca legitim între companii diferite (același browser folosit succesiv) — vezi ISSUES.md', async () => {
    const companyA = await registerCompany(app, 'DeviceA');
    const companyB = await registerCompany(app, 'DeviceB');
    const fcmToken = `fcm-${uniqueSuffix()}`;

    await request(app.getHttpServer())
      .post('/api/notifications/device-tokens')
      .set('Authorization', `Bearer ${companyA.accessToken}`)
      .send({ fcmToken, platform: 'web' })
      .expect(204);

    // Compania B revendică același token (ex: cineva a folosit același
    // calculator/browser pentru două companii diferite) — nu trebuie să
    // dea eroare de RLS, ca înainte de fix.
    await request(app.getHttpServer())
      .post('/api/notifications/device-tokens')
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .send({ fcmToken, platform: 'web' })
      .expect(204);

    // Tokenul chiar a trecut la userul din compania B, nu a rămas la A.
    const row = await prisma.runBypassingRls((tx) => tx.deviceToken.findUnique({ where: { fcmToken } }));
    expect(row?.userId).toBe(companyB.userId);
  });

  it('dezînregistrarea șterge doar propriul token, nu poate afecta tokenul altui user', async () => {
    const admin = await registerCompany(app, 'DeviceUnreg');
    const employee = await createEmployeeAccount(app, admin.accessToken);
    const fcmToken = `fcm-${uniqueSuffix()}`;

    await request(app.getHttpServer())
      .post('/api/notifications/device-tokens')
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ fcmToken, platform: 'web' })
      .expect(204);

    // Adminul încearcă să dezînregistreze tokenul angajatului — nu are efect.
    await request(app.getHttpServer())
      .delete(`/api/notifications/device-tokens/${fcmToken}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(204);
    const stillThere = await prisma.runBypassingRls((tx) => tx.deviceToken.findUnique({ where: { fcmToken } }));
    expect(stillThere).not.toBeNull();

    // Angajatul își dezînregistrează propriul token — funcționează.
    await request(app.getHttpServer())
      .delete(`/api/notifications/device-tokens/${fcmToken}`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .expect(204);
    const gone = await prisma.runBypassingRls((tx) => tx.deviceToken.findUnique({ where: { fcmToken } }));
    expect(gone).toBeNull();
  });
});
