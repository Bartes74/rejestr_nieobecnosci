import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

// NFR-5 — w produkcji wymagane sekrety muszą być ustawione (fail-fast, bez niebezpiecznych domyślnych).
// W dev/test ustawiamy fallback, by lokalne uruchomienia i suity verify-*.mjs działały bez konfiguracji.
function assertEnv() {
  const required = ['JWT_SECRET', 'DATABASE_URL'];
  if (process.env.NODE_ENV === 'production') {
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) throw new Error(`Brak wymaganych zmiennych środowiskowych: ${missing.join(', ')}`);
  } else {
    process.env.JWT_SECRET ||= 'dev-secret-zmien-na-produkcji';
  }
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
