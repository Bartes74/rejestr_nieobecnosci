# Web (React+Vite) → statyki serwowane przez Caddy, który też terminuje TLS i proxuje /api.
# Kontekst budowania = katalog główny monorepo.
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm -F @nieobecnosci/web build

FROM caddy:2-alpine
COPY --from=build /app/apps/web/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
