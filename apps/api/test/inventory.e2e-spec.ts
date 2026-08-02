import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { registerCompany } from './helpers/company';

describe('Inventar — Produse + Mișcări de stoc (e2e)', () => {
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

  it('produsul nou are stoc 0 și mișcările IN/OUT actualizează stocul corect', async () => {
    const { accessToken } = await registerCompany(app, 'Inv');

    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Laptop Dell XPS 13', sku: `DELL-${Date.now()}`, unitPriceCents: 450000 })
      .expect(201);
    expect(Number(product.body.stockQuantity)).toBe(0);

    await request(app.getHttpServer())
      .post('/api/stock-movements')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId: product.body.id, type: 'IN', quantity: 10, reason: 'Recepție marfă' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/stock-movements')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId: product.body.id, type: 'OUT', quantity: 3 })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .get(`/api/products/${product.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(Number(updated.body.stockQuantity)).toBe(7);
    expect(updated.body.stockMovements).toHaveLength(2);
  });

  it('blochează ștergerea unui produs cu stoc > 0', async () => {
    const { accessToken } = await registerCompany(app, 'InvDel');

    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Monitor', sku: `MON-${Date.now()}`, unitPriceCents: 120000 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/stock-movements')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId: product.body.id, type: 'IN', quantity: 5 })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/products/${product.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);
  });

  it('respinge un SKU duplicat în aceeași companie', async () => {
    const { accessToken } = await registerCompany(app, 'InvSku');
    const sku = `DUP-${Date.now()}`;
    await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Produs 1', sku, unitPriceCents: 1000 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Produs 2', sku, unitPriceCents: 2000 })
      .expect(409);
  });

  it('izolează produsele și mișcările de stoc complet între două companii', async () => {
    const companyA = await registerCompany(app, 'InvA');
    const companyB = await registerCompany(app, 'InvB');

    const productA = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${companyA.accessToken}`)
      .send({ name: 'Produs secret A', sku: `SECRET-${Date.now()}`, unitPriceCents: 9999 })
      .expect(201);

    // Compania B poate folosi ACELAȘI SKU — unicitatea e per-companie, nu globală.
    await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .send({ name: 'Produs B, alt nume', sku: productA.body.sku, unitPriceCents: 111 })
      .expect(201);

    const productsForB = await request(app.getHttpServer())
      .get('/api/products')
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(200);
    expect(productsForB.body).toHaveLength(1);
    expect(productsForB.body[0].name).not.toBe('Produs secret A');

    await request(app.getHttpServer())
      .get(`/api/products/${productA.body.id}`)
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .expect(404);

    // B nu poate înregistra o mișcare de stoc pe produsul lui A.
    await request(app.getHttpServer())
      .post('/api/stock-movements')
      .set('Authorization', `Bearer ${companyB.accessToken}`)
      .send({ productId: productA.body.id, type: 'IN', quantity: 100 })
      .expect(404);
  });
});
