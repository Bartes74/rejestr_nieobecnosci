# Nieobecności

Aplikacja do rejestrowania i monitorowania nieobecności pracowników (~300 użytkowników, 6 zespołów).
Zastępuje rozproszone pliki Excel: jedno źródło prawdy, wielodostęp bez blokad, licznik balansu na żywo,
agregacja w górę hierarchii. Stack: TypeScript end-to-end, PostgreSQL, on-premise.

Wymagania, backlog i prototyp: dokumenty w katalogu głównym; design system w
`Analiza dokumentów i ekranów/`.

## Struktura

```
packages/core/   silnik wyliczeń (czyste funkcje, 27 testów) — okresy, dni robocze, balans, capacity, iCal
apps/api/        NestJS + Prisma + PostgreSQL — ~50 endpointów, RBAC, ochrona L4, import/eksport .xlsx
apps/web/        React + Vite — 12 ekranów na design systemie przeniesionym z prototypu
prisma/          model danych (11 modeli)
scripts/         backup bazy + jednostki systemd
docker-compose.yml       PostgreSQL (dev, port 5440)
docker-compose.prod.yml  wdrożenie on-prem: api + web (Caddy/TLS) + postgres
```

Rdzeń wyliczeń jest celowo oddzielony od frameworka: **UoP** rozliczany w roku kalendarzowym,
**B2B/OUT** w roku budżetowym (−1 miesiąc). Niewykorzystane dni przechodzą na kolejny okres jako
urlop zaległy (nie przepadają) — **automatycznie**, bez działania administratora: brak wiersza puli
w nowym okresie oznacza „policz z poprzednich", nie „zero" (FR-B7). Ręczna korekta administratora
nadpisuje wyliczenie i staje się podstawą kolejnych okresów.
L4 nie obniża puli urlopu, ale zmniejsza capacity.

## Uruchomienie (dev)

```bash
pnpm install
pnpm db:up                          # PostgreSQL w dockerze (port 5440)
cp .env.example .env
pnpm db:migrate                     # migracje schematu
pnpm db:seed                        # admin/admin + typy + kalendarz świąt (idempotentny)

pnpm -F @nieobecnosci/api build
PORT=3100 node apps/api/dist/main.js     # API na http://localhost:3100/api
pnpm -F @nieobecnosci/web dev            # frontend http://localhost:5188
```

Vite proxuje `/api` na `http://localhost:3100` — inny port API ustaw przez `VITE_API_TARGET`.
Uwaga: nie eksportuj `DATABASE_URL` ręcznie w shellu — Prisma ładuje `.env` sama.

## Dane demo i logowanie

```bash
node apps/api/demo-seed.mjs     # wymaga zbudowanego API (dist/) — czyści bazę i wgrywa scenariusz demo
```

Tworzy strukturę **Pion Operacji › Departament IT › Tribe Alfa › 5 squadów**, 21 osób, 7 sprintów
i nieobecności **względem dnia uruchomienia** (bieżący tydzień, przyszły tydzień, historia pod heatmapę).

| Rola | Login | Hasło |
| --- | --- | --- |
| Administrator | `admin` | `admin` |
| Dyrektor | `dyrektor` | `demo123` |
| PMO | `pmo` | `demo123` |
| Lider | `lider` | `demo123` |
| Product Owner | `po` | `demo123` |
| Pracownik | `pracownik` | `demo123` |

Dodatkowo `anna`, `bartek` (role kluczowe — generują alert kolizji), `celina` (B2B), `ext` (OUT)
i `halina`, hasło `demo123`.

`halina` to jedyna osoba w demo z historią sprzed bieżącego okresu (zatrudniona 1 stycznia roku
poprzedniego, 18 z 26 dni wykorzystanych). Jej **8 dni zaległych wylicza aplikacja** — nie ma
wiersza `LeaveAllowance` na bieżący okres, więc pokazuje działanie FR-B7: brak wiersza znaczy
„policz z poprzednich okresów", nie „zero". Dla porównania `pracownik` ma 3 dni zaległe wpisane
**ręcznie** przez administratora — korekta wygrywa nad wyliczeniem.

`pracownik` (UoP) i `ext` (OUT) to para do porównania form zatrudnienia: ta sama rola i te same
ekrany, ale inny okres rozliczeniowy (kalendarzowy vs budżetowy gru–lis) i inne traktowanie L4
wobec puli urlopu (FR-B5).

### Kto co widzi (RBAC)

| | Pulpit / Wpis / Kalendarz / Historia | Capacity | Zespół | Raporty | Eksport płac | Heatmapa | Administracja |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **Pracownik** | ✓ | — | — | — | — | — | — |
| **PO** | ✓ | ✓ | — | — | — | ✓ | — |
| **Lider** | ✓ | ✓ | ✓ (swój Tribe) | ✓ (Tribe) | — | ✓ | — |
| **Dyrektor** | ✓ | ✓ | — | ✓ (pion/dept) | — | ✓ | — |
| **PMO** | ✓ | — | — | ✓ | ✓ | — | analityka |
| **Administrator** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Zakres egzekwuje backend (guard + serializacja zależna od roli), nie ukrywanie w UI.
Znacznik **L4** widzą wyłącznie role z uprawnieniem `VIEW_L4` (admin, osoby wskazane) — każdy taki
odczyt trafia do audytu. Dla pozostałych L4 jest nieodróżnialne od zwykłej nieobecności: w kalendarzu,
w kanale iCal zespołu, w powiadomieniach i w eksportach.

## Testy i weryfikacja

```bash
pnpm run verify:offline    # build + typecheck (3 pakiety) + 83 testy silnika — bez bazy i API
pnpm run verify:suites     # 30 suit integracyjnych (255 asercji) przeciw działającemu API
```

`verify:suites` wymaga **uruchomionego API** i zmiennej `API` (domyślnie `http://localhost:3100/api`).
Suity **czyszczą bazę** przed przebiegiem — po nich odtwórz dane demo (`node apps/api/demo-seed.mjs`).
Pojedynczą suitę uruchomisz bezpośrednio:

```bash
API=http://localhost:3100/api node apps/api/verify-faza3-ical.mjs
```

CI (`.github/workflows/ci.yml`) uruchamia dokładnie te same kroki na PostgreSQL w usłudze.

### Test obciążeniowy (NFR-1)

```bash
API=http://localhost:3100/api node apps/api/loadtest.mjs   # doseedowuje bazę do 300 osób
```

Ostatni przebieg (10.08.2026, PostgreSQL w dockerze na jednej maszynie deweloperskiej,
300 pracowników, 300 żądań na endpoint, współbieżność 50):

| Endpoint | p50 | p95 | budżet |
| --- | --- | --- | --- |
| pulpit (`/analytics/adoption`) | 16 ms | **43 ms** | < 2000 ms |
| kalendarz (`/calendar`) | 34 ms | **50 ms** | < 2000 ms |
| balans (`/employees/:id/balance`) | 20 ms | **30 ms** | < 1000 ms |

Zapas jest dwa rzędy wielkości, ale to pomiar na maszynie deweloperskiej — przed produkcją
powtórz go na docelowym sprzęcie i przez sieć organizacji.

## Wdrożenie produkcyjne (on-prem)

```bash
cp .env.prod.example .env.prod      # uzupełnij hasła, JWT_SECRET, domenę, SMTP
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Jedna maszyna: `api` + `web` (Caddy z automatycznym TLS) + `postgres` z wolumenem.
Bez `JWT_SECRET` API **celowo nie wstanie** w produkcji (fail-fast). `SCHEDULER_ENABLED=true`
włącza nocne przypomnienia o zaległym urlopie i retencję danych.

## Backup i odtwarzanie (NFR-4)

```bash
scripts/backup.sh /var/backups/nieobecnosci      # dump + gzip + retencja 30 dni
# odtworzenie:
gunzip -c BACKUP.sql.gz | docker compose exec -T db psql -U nieobecnosci nieobecnosci
```

Codzienny backup: cron albo `scripts/nieobecnosci-backup.{service,timer}` (systemd).
**RPO** = odstęp backupów (~24 h), **RTO** = czas odtworzenia z dumpu; test odtworzenia rób okresowo
na osobnej bazie.

## Bezpieczeństwo (NFR-5)

Hasła hashowane `scrypt`; dostęp przez JWT + RBAC. Zdarzenia bezpieczeństwa (nieudane logowania
`LOGIN_FAILED`, odmowy dostępu `ACCESS_DENIED`, odczyt znacznika L4 `VIEW_TYPES`) trafiają do
tabeli `AuditLog`. Szyfrowanie w tranzycie zapewnia Caddy (TLS); w spoczynku — dysk/Postgres
na poziomie wdrożenia.

## Monitoring i dostępność (NFR-2)

`GET /api/health` to sonda dla monitoringu: **200** = aplikacja żyje i baza odpowiada
(`{status, db, uptimeSec, version}`), **503** = baza niedostępna. Ustaw alerty na kod ≠ 200 oraz czas
odpowiedzi. Adopcję mierzy `GET /api/analytics/adoption` (NFR-8) — panel „Analityka adopcji"
w Konfiguracji.

## Dostępność cyfrowa (NFR-7, WCAG 2.1 AA)

Design system celuje w AA (kontrast tokenów, brak czystej czerni/bieli na tekście). Interakcje
opierają się na natywnych elementach (`<button>`, `<a>`, `<input type="date/time">`, `<select>`) —
z klawiatury i czytnikiem ekranu. Kontrolki bez widocznej etykiety mają `aria-label`, aktywne pozycje
nawigacji `aria-current`, przełączniki uprawnień `aria-pressed`. `<html lang="pl">`.

**Audyt axe-core 4.13 (10.08.2026):** 12 ekranów (logowanie + 11 tras jako administrator), reguły
`wcag2a, wcag2aa, wcag21a, wcag21aa` — **0 naruszeń**. Wykryte i naprawione w tym przebiegu:
przewijane siatki kalendarza i heatmapy nie przyjmowały fokusu (`scrollable-region-focusable`,
WCAG 2.1.1) — obie mają teraz `role="region"`, nazwę i `tabIndex={0}`.

**1.4.4 Resize Text:** przy powiększeniu 200% treść zawija się w kartach, żaden kontener nie przycina
tekstu i żadna kontrolka nie znika. Poziome przewijanie przy 200% jest dopuszczone przez 1.4.4
(zakazuje go dopiero 1.4.10 Reflow, wyłączone decyzją desktop-only — patrz `PRODUCT.md`).

Audyt powtórzysz bez dodatkowych narzędzi: `axe-core` jest devDependency `apps/web`, a serwer dev
podaje go pod `/node_modules/axe-core/axe.min.js`. W konsoli przeglądarki:

```js
axe.run(document, { preload: false, runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } }).then(r => console.table(r.violations))
```

## Stan i co dalej

**Zrobione:** całe MVP, Faza 2 (16 pozycji), część Fazy 3 — heatmapa pokrycia (C4), operacje masowe
(A10), kanały iCal (F4), powiadomienia in-app, scheduler, ekran „Zespół" (korekta wpisów przez lidera,
FR-A5), import .xlsx z konfigurowalnym mapowaniem kolumn (FR-G5/D4), automatyczne rolowanie urlopu
zaległego na przełomie okresu (FR-B7), zweryfikowana wydajność przy 300 użytkownikach (NFR-1)
i audyt dostępności axe bez naruszeń (NFR-7).

Stan każdej historyjki z backlogu odnotowuje kolumna **„Stan wdrożenia"** w
`Backlog - aplikacja nieobecnosci.xlsx` (przegląd z 10.08.2026).

**Świadomie niezrobione** — do decyzji przed produkcją:

- Integracje: **AD/SSO** (jest przygotowany szew `AuthProvider`, brak implementacji OIDC), TETA, JIRA.
- **NFR-9** — interfejs EN dla współpracowników OUT (priorytet „Could", potrzeba nierozstrzygnięta).
- **NFR-2** — progi i alerty monitoringu: aplikacja daje sondę `/api/health`, resztę konfiguruje się
  w monitoringu organizacji.
- **NFR-6** (mobile) i **NFR-7** (1.4.10 Reflow) — zawężenia wymagające potwierdzenia zamawiającego;
  wniosek gotowy w `WNIOSEK-ZAWEZENIE-NFR.md`.
- Układ kolumn plików importu do ustalenia z zamawiającym (na razie mapowanie konfigurowalne).
- Heatmapa pobiera capacity per squad×sprint (N×M zapytań) — przy większej skali dołożyć zbiorczy
  endpoint `/capacity/matrix`.
- Hasło startowe `admin/admin` — zmienić przy pierwszym wdrożeniu.
