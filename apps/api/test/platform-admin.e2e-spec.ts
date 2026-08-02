import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { registerCompany } from './helpers/company';

const PLATFORM_ADMIN_EMAIL = process.env.SEED_PLATFORM_ADMIN_EMAIL ?? 'dev@worksphere.ro';
const PLATFORM_ADMIN_PASSWORD = process.env.SEED_PLATFORM_ADMIN_PASSWORD ?? 'DevReset1234!';

describe('Panou developer / platform-admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let platformAdminToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const loginRes = await request(app.getHttpServer())
      .post('/api/platform-admin/login')
      .send({ email: PLATFORM_ADMIN_EMAIL, password: PLATFORM_ADMIN_PASSWORD })
      .expect(200);
    platformAdminToken = loginRes.body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('login cu parolă greșită e respins', async () => {
    await request(app.getHttpServer())
      .post('/api/platform-admin/login')
      .send({ email: PLATFORM_ADMIN_EMAIL, password: 'gresita' })
      .expect(401);
  });

  it('un JWT normal de user de companie nu poate accesa rutele de platform-admin', async () => {
    const admin = await registerCompany(app, 'PlatNoAccess');
    await request(app.getHttpServer())
      .get('/api/platform-admin/companies')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(401);
  });

  it('listCompanies vede compania nou-înregistrată, cu numărul corect de utilizatori', async () => {
    const admin = await registerCompany(app, 'PlatList');
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    const companiesRes = await request(app.getHttpServer())
      .get('/api/platform-admin/companies')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(200);

    const found = (companiesRes.body as Array<{ id: string; userCount: number }>).find(
      (c) => c.id === me.body.companyId,
    );
    expect(found).toBeDefined();
    expect(found?.userCount).toBe(1);
  });

  it('deleteCompany șterge DOAR compania țintă, restul platformei rămâne neatins', async () => {
    const target = await registerCompany(app, 'PlatDelTarget');
    const survivor = await registerCompany(app, 'PlatDelSurvivor');
    const targetMe = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${target.accessToken}`)
      .expect(200);
    const survivorMe = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${survivor.accessToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .delete(`/api/platform-admin/companies/${targetMe.body.companyId}`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(200);
    expect(res.body.deletedCompanyId).toBe(targetMe.body.companyId);

    const deleted = await prisma.runBypassingRls((tx) =>
      tx.company.findUnique({ where: { id: targetMe.body.companyId } }),
    );
    expect(deleted).toBeNull();

    // Compania „supraviețuitoare” nu a fost atinsă.
    const survives = await prisma.runBypassingRls((tx) =>
      tx.company.findUnique({ where: { id: survivorMe.body.companyId } }),
    );
    expect(survives).not.toBeNull();
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${survivor.accessToken}`)
      .expect(200);
  });

  it('deleteCompany pe un id inexistent întoarce 404', async () => {
    await request(app.getHttpServer())
      .delete('/api/platform-admin/companies/id-inexistent')
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .expect(404);
  });
});
