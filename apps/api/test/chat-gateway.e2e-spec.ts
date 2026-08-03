import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { createEmployeeAccount, registerCompany } from './helpers/company';

/**
 * `ChatGateway` — livrarea în timp real (vezi `chat.gateway.ts`). Spre
 * deosebire de restul testelor e2e (care folosesc doar `app.getHttpServer()`
 * prin supertest, fără port real), un client Socket.IO are nevoie de o
 * conexiune de rețea reală — de-aia acest fișier pornește serverul cu
 * `app.listen(0)` (port liber, ales de OS) și se conectează efectiv la el.
 */
describe('ChatGateway — livrare mesaje prin WebSocket (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const openSockets: Socket[] = [];

  function connectSocket(accessToken: string | undefined): Socket {
    const socket = io(`${baseUrl}/chat`, {
      autoConnect: false,
      auth: { token: accessToken },
      reconnection: false,
    });
    openSockets.push(socket);
    return socket;
  }

  function waitFor<T = unknown>(socket: Socket, event: string, timeoutMs = 3000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout așteptând '${event}'`)), timeoutMs);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await app.listen(0);
    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${typeof address === 'string' ? address : address!.port}`;
  });

  afterEach(() => {
    while (openSockets.length) openSockets.pop()!.disconnect();
  });

  afterAll(async () => {
    // `app.close()` oprește corect serverul, dar timer-ele interne de
    // heartbeat ale engine.io pentru conexiunile testate mai devreme pot
    // rămâne programate până la `pingTimeout` (20s implicit) înainte să se
    // elibereze complet — Jest poate raporta un handle "agățat" la +1s din
    // acest motiv, deși procesul chiar iese singur, doar mai târziu. Nu e o
    // scurgere reală (fiecare test își deconectează explicit socket-urile în
    // `afterEach`), doar o particularitate cunoscută a engine.io în teste.
    await app.close();
  });

  it('refuză conexiunea fără token (sau cu unul invalid)', async () => {
    const noToken = connectSocket(undefined);
    const disconnectNoToken = waitFor(noToken, 'disconnect');
    noToken.connect();
    await expect(disconnectNoToken).resolves.toBeDefined();

    const badToken = connectSocket('nu-e-un-jwt-valid');
    const disconnectBadToken = waitFor(badToken, 'disconnect');
    badToken.connect();
    await expect(disconnectBadToken).resolves.toBeDefined();
  });

  it('livrează un mesaj nou, instant, tuturor membrilor conectați la canal', async () => {
    const admin = await registerCompany(app, 'WsPub');
    const employee = await createEmployeeAccount(app, admin.accessToken);

    const channel = await request(app.getHttpServer())
      .post('/api/chat/channels')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'general-ws' })
      .expect(201);

    const adminSocket = connectSocket(admin.accessToken);
    const employeeSocket = connectSocket(employee.accessToken);
    adminSocket.connect();
    employeeSocket.connect();
    await Promise.all([waitFor(adminSocket, 'connect'), waitFor(employeeSocket, 'connect')]);

    adminSocket.emit('join_channel', { channelId: channel.body.id });
    employeeSocket.emit('join_channel', { channelId: channel.body.id });
    // Nu există un ACK explicit de join — o mică pauză e suficientă cât
    // handler-ul async `handleJoin` termină `client.join(...)` pe server.
    await new Promise((r) => setTimeout(r, 200));

    const adminReceived = waitFor<{ content: string; channelId: string }>(adminSocket, 'new_message');

    await request(app.getHttpServer())
      .post(`/api/chat/channels/${channel.body.id}/messages`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ content: 'Livrat instant, nu peste 4 secunde' })
      .expect(201);

    const received = await adminReceived;
    expect(received.content).toBe('Livrat instant, nu peste 4 secunde');
    expect(received.channelId).toBe(channel.body.id);
  });

  it('refuză join_channel pe un canal privat din care nu faci parte, fără să livreze mesajele lui', async () => {
    const admin = await registerCompany(app, 'WsPriv');
    const outsider = await createEmployeeAccount(app, admin.accessToken);

    const channel = await request(app.getHttpServer())
      .post('/api/chat/channels')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'privat-ws', isPrivate: true, memberIds: [admin.userId] })
      .expect(201);

    const outsiderSocket = connectSocket(outsider.accessToken);
    outsiderSocket.connect();
    await waitFor(outsiderSocket, 'connect');

    const joinError = waitFor<{ channelId: string; message: string }>(outsiderSocket, 'join_error');
    outsiderSocket.emit('join_channel', { channelId: channel.body.id });
    const error = await joinError;
    expect(error.channelId).toBe(channel.body.id);

    // Confirmă că refuzul e real: un mesaj trimis de admin (direct în DB, ca
    // membru legitim) NU ajunge la outsider, care nu s-a alăturat camerei.
    const neverReceived = waitFor(outsiderSocket, 'new_message', 800).then(
      () => 'received',
      () => 'timeout',
    );
    await request(app.getHttpServer())
      .post(`/api/chat/channels/${channel.body.id}/messages`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ content: 'Doar pentru membri' })
      .expect(201);
    await expect(neverReceived).resolves.toBe('timeout');
  });
});
