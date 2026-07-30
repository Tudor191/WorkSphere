// IMPORTANT: `.env`-ul acestei aplicații trebuie încărcat ÎNAINTE de orice
// alt import. `@worksphere/database` (Prisma Client generat) își încarcă
// la require() propriul `.env` din `packages/database/` (folosit pentru
// comenzi CLI Prisma — migrări/seed — care rulează din acel folder), iar
// acela conține o conexiune superuser diferită de a API-ului. Dacă acel
// `require` s-ar întâmpla primul (ex: prin lanțul de import-uri al
// AppModule), `process.env.DATABASE_URL` ar fi setat greșit, iar
// PostgreSQL Row Level Security ar fi complet bypass-uit (superuserii
// ocolesc RLS necondiționat) — exact genul de scurgere cross-tenant pe
// care întreaga arhitectură multi-tenant încearcă să o prevină. Încărcarea
// explicită, cu `override: true`, garantează că `.env`-ul propriu al
// API-ului câștigă întotdeauna, indiferent de ordinea de import.
import { config as loadEnv } from 'dotenv';
loadEnv({ override: true });

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get<string[]>('app.corsOrigins'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('WorkSphere API')
    .setDescription('API REST pentru platforma SaaS WorkSphere')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('app.port')!;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`WorkSphere API pornit pe portul ${port} — docs la /api/docs`);
}

bootstrap();
