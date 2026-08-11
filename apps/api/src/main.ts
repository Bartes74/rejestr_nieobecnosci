import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { isLocalEnv } from './env';

// NFR-5 — wymagane sekrety muszą być ustawione (fail-fast, bez niebezpiecznych domyślnych).
// Awaryjny sekret przysługuje wyłącznie uruchomieniu jawnie lokalnemu — dlaczego akurat tak
// postawione jest pytanie, tłumaczy `isLocalEnv`. Środowisko nieznane traktujemy jak produkcję:
// brak sekretu zatrzymuje start, zamiast po cichu podpisać tokeny stałą wartością z repozytorium.
//
// Lokalnie nic to nie zmienia także bez NODE_ENV: `.env` (z `.env.example`) wczytuje się przy
// imporcie @prisma/client, czyli zanim ta funkcja się wykona.
function assertEnv() {
  if (isLocalEnv()) {
    process.env.JWT_SECRET ||= 'dev-secret-zmien-na-produkcji';
    return;
  }
  const missing = ['JWT_SECRET', 'DATABASE_URL'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Brak wymaganych zmiennych środowiskowych: ${missing.join(', ')}`);
}

async function bootstrap() {
  assertEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(helmet()); // M4 — nagłówki bezpieczeństwa (nosniff, X-Frame-Options, HSTS itd.)
  app.set('trust proxy', 1); // M1 — prawdziwe IP klienta z X-Forwarded-For (za Caddy) dla rate-limitingu
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  console.log(`API: http://localhost:${port}/api`);
}
void bootstrap();
