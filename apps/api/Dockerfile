# API (NestJS + Prisma). Kontekst budowania = katalog główny monorepo (patrz docker-compose.prod.yml).
FROM node:22-slim
WORKDIR /app
# openssl wymagane przez silnik Prismy
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* && corepack enable
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm -F @nieobecnosci/core build \
 && pnpm exec prisma generate \
 && pnpm -F @nieobecnosci/api build
ENV NODE_ENV=production
# Migracje przy starcie, potem aplikacja. Sekrety (DATABASE_URL, JWT_SECRET, SMTP_*) z env_file (.env.prod).
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node apps/api/dist/main.js"]
