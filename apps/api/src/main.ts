import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from '@nestjs/common';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';
import { garantirChaves } from './common/chaves';

async function bootstrap() {
  for (const v of ['DATABASE_URL', 'JWT_ACCESS_SECRET']) {
    if (!process.env[v]) throw new Error(`Variável ${v} ausente. Copie apps/api/.env.example para apps/api/.env`);
  }
  garantirChaves();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 2 * 1024 * 1024 }),
    { logger: ['error', 'warn', 'log'] },
  );
  await app.register(helmet, { crossOriginResourcePolicy: { policy: 'cross-origin' } });
  await app.register(cors, {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174').split(',').map((s) => s.trim()),
    credentials: true,
  });
  await app.register(multipart, { limits: { fileSize: 8 * 1024 * 1024, files: 1 } });
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API MOTORIZE em http://localhost:${port}/api/v1`, 'Bootstrap');
}

bootstrap();
