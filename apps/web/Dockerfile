# Web (React+Vite) → statyki serwowane przez Caddy, który też terminuje TLS i proxuje /api.
# Kontekst budowania = katalog główny monorepo.
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
# Najpierw rdzeń: frontend importuje `@nieobecnosci/core/*` z jego `dist`, a `.dockerignore` wyklucza
# `**/dist` z kontekstu. Bez tego kroku obraz budował się tylko tam, gdzie `dist` leżał na dysku
# z lokalnego builda — na czystym serwerze `tsc` nie znajdował modułów rdzenia. Jak w apps/api/Dockerfile.
RUN pnpm install --frozen-lockfile \
 && pnpm -F @nieobecnosci/core build \
 && pnpm -F @nieobecnosci/web build

FROM caddy:2-alpine
COPY --from=build /app/apps/web/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
