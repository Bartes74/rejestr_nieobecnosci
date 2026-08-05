# Nieobecności

Aplikacja do rejestrowania i monitorowania nieobecności pracowników (~300 użytkowników, 6 zespołów).
Zastępuje rozproszone pliki Excel: jedno źródło prawdy, wielodostęp bez blokad, licznik balansu na żywo,
agregacja w górę hierarchii. Stack: TypeScript end-to-end, PostgreSQL, on-premise.

Wymagania, backlog i UI: patrz dokumenty w katalogu głównym oraz design system w
`Analiza dokumentów i ekranów/`. Plan budowy: `~/.claude/plans/…nieobecnosci…`.

## Struktura

```
packages/core/   silnik wyliczeń (czyste funkcje, testowany) — okresy, dni robocze, balans, capacity
apps/web/        React + Vite + design system (przeniesiony z prototypu)
prisma/          model danych (PostgreSQL)
docker-compose.yml  PostgreSQL + Adminer (dev)
```

## Uruchomienie (dev)

```bash
pnpm install
pnpm db:up                          # PostgreSQL w dockerze (port 5440)
cp .env.example .env
pnpm db:migrate                     # migracje schematu
pnpm db:seed                        # admin/admin + typy + kalendarz świąt (idempotentny)

pnpm -F @nieobecnosci/core test     # testy silnika wyliczeń
pnpm -F @nieobecnosci/api build && pnpm -F @nieobecnosci/api start   # API (domyślnie :3000)
pnpm -F @nieobecnosci/web dev       # frontend http://localhost:5173
```

Logowanie startowe: **admin / admin** (zmień po pierwszym zalogowaniu). Vite proxuje `/api`
do backendu — jeśli API słucha na innym porcie niż 3000, ustaw `VITE_API_TARGET`.
Uwaga: nie eksportuj `DATABASE_URL` ręcznie w shellu — Prisma ładuje `.env` sama.

## Backup i odtwarzanie (NFR-4)

```bash
chmod +x scripts/backup.sh
scripts/backup.sh /var/backups/nieobecnosci      # dump + gzip + retencja 30 dni
# odtworzenie:
gunzip -c BACKUP.sql.gz | docker compose exec -T db psql -U nieobecnosci nieobecnosci
```
Codzienny backup ustaw w cronie. **RPO** = odstęp backupów (domyślnie ~24 h), **RTO** = czas
odtworzenia z dumpu; test odtworzenia wykonuj okresowo na osobnej bazie.

## Bezpieczeństwo (NFR-5)

Hasła hashowane `scrypt`; dostęp przez JWT + RBAC. Zdarzenia bezpieczeństwa (nieudane logowania
`LOGIN_FAILED`, odmowy dostępu `ACCESS_DENIED`, odczyt znacznika L4 `VIEW_TYPES`) trafiają do
tabeli `AuditLog`. Szyfrowanie w tranzycie (TLS) i w spoczynku (dysk/Postgres) konfiguruje się
na poziomie wdrożenia on-prem.

## Monitoring i dostępność (NFR-2)

`GET /api/health` to sonda dla monitoringu: **200** = aplikacja żyje i baza odpowiada
(`{status, db, uptimeSec, version}`), **503** = baza niedostępna. Wystaw ją systemowi monitorującemu
(np. Prometheus blackbox / uptime-check) i ustaw alerty na kod ≠ 200 oraz czas odpowiedzi.
Adopcję mierzy `GET /api/analytics/adoption` (NFR-8) — widoczna w Konfiguracji (panel „Analityka adopcji").

## Dostępność cyfrowa (NFR-7, WCAG 2.1 AA)

Design system celuje w AA (kontrast tokenów, brak czystej czerni/bieli na tekście). Interakcje
opierają się na natywnych elementach (`<button>`, `<a>`, `<input type="date/time">`,
`<select>`) — z klawiatury i czytnikiem ekranu. Kontrolki bez widocznej etykiety mają `aria-label`,
aktywne pozycje nawigacji `aria-current`, przełączniki uprawnień `aria-pressed`. `<html lang="pl">`.
Pełny audyt AA (np. axe) wykonać przed wydaniem produkcyjnym.
