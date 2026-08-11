# Nieobecności

Aplikacja do rejestrowania i monitorowania nieobecności pracowników (~300 użytkowników, 6 zespołów).
Zastępuje rozproszone pliki Excel: jedno źródło prawdy, wielodostęp bez blokad, licznik balansu na żywo,
agregacja w górę hierarchii. Stack: TypeScript end-to-end, PostgreSQL, on-premise.

Wymagania, backlog i prototyp: dokumenty w katalogu głównym; design system w
`Analiza dokumentów i ekranów/`.

## Struktura

```
packages/core/   silnik wyliczeń (czyste funkcje, 83 testy) — okresy, dni robocze, balans, capacity, iCal
apps/api/        NestJS + Prisma + PostgreSQL — ~53 endpointy, RBAC, ochrona L4, import/eksport .xlsx
apps/web/        React + Vite — 12 ekranów na design systemie przeniesionym z prototypu
prisma/          model danych (13 modeli)
scripts/         backup bazy + test odtworzenia + jednostki systemd
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
odczyt trafia do audytu, zarówno z listy wpisów, jak i z eksportu płacowego. Dla pozostałych L4 jest nieodróżnialne od zwykłej nieobecności: w kalendarzu,
w kanale iCal zespołu, w powiadomieniach i w eksportach.

## Testy i weryfikacja

```bash
pnpm run verify:offline               # build + typecheck (3 pakiety) + 83 testy silnika — bez bazy i API
pnpm run verify:suites                # 30 suit integracyjnych (255 asercji) przeciw działającemu API
pnpm -F @nieobecnosci/web lint        # bramka dostępności: reguły jsx-a11y na src/ (w tym .jsx design systemu)
pnpm audit --prod --audit-level high  # bramka podatności w zależnościach produkcyjnych
```

`verify:suites` wymaga **uruchomionego API** i zmiennej `API` (domyślnie `http://localhost:3100/api`).
Suity **czyszczą bazę** przed przebiegiem — po nich odtwórz dane demo (`node apps/api/demo-seed.mjs`).
Pojedynczą suitę uruchomisz bezpośrednio:

```bash
API=http://localhost:3100/api node apps/api/verify-faza3-ical.mjs
```

CI (`.github/workflows/ci.yml`) uruchamia dokładnie te same cztery komendy na PostgreSQL w usłudze.
Lint i audyt zależności są **blokujące** — bramka, która nigdy nie pada, nie jest bramką. Nową
podatność „high" w zależności transitive domykaj przez `pnpm.overrides` w `package.json`, nie przez
obniżenie progu.

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

# JEDNORAZOWO, po pierwszym starcie (migracje muszą już być wykonane):
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U nieobecnosci -d nieobecnosci -v haslo="'HASLO_Z_DATABASE_URL'" < scripts/db-appuser.sql
docker compose -f docker-compose.prod.yml restart api
```

Jedna maszyna: `api` + `web` (Caddy z automatycznym TLS) + `postgres` z wolumenem.
Bez `JWT_SECRET` API **celowo nie wstanie** w produkcji (fail-fast). `SCHEDULER_ENABLED=true`
włącza nocne przypomnienia o zaległym urlopie i retencję danych.

**Rozdzielenie ról bazodanowych.** Aplikacja pracuje na roli `nieobecnosci_app`, która nie może
modyfikować ani kasować wpisów dziennika audytu; migracje idą osobnym poświadczeniem właściciela
(`MIGRATE_DATABASE_URL`). Dzięki temu niemodyfikowalność dziennika (FR-I1) jest właściwością bazy,
a nie obietnicą kodu — aplikacja nie może sama sobie przywrócić tego prawa, bo nie jest
właścicielem tabeli. Krok jest opcjonalny: bez `MIGRATE_DATABASE_URL` całość działa na jednym
poświadczeniu, tyle że dziennik da się wtedy wyczyścić.

Skrypt uruchamia się na istniejących tabelach, więc **po każdej migracji dodającej tabelę**
trzeba go powtórzyć (jest idempotentny — odświeża hasło i uprawnienia, niczego nie psuje).

## Backup i odtwarzanie (NFR-4)

```bash
scripts/backup.sh /var/backups/nieobecnosci        # dump + gzip + retencja 30 dni
scripts/restore-test.sh /var/backups/nieobecnosci  # odtworzenie najnowszego dumpu do bazy tymczasowej
# odtworzenie właściwe:
gunzip -c BACKUP.sql.gz | docker compose exec -T db psql -U nieobecnosci nieobecnosci
```

Codzienny backup: cron albo `scripts/nieobecnosci-backup.{service,timer}` (systemd).
**RPO** = odstęp backupów (~24 h), **RTO** = czas odtworzenia z dumpu.

`restore-test.sh` uruchamiaj **kwartalnie**: bierze najnowszy dump, odtwarza go do bazy tymczasowej
obok produkcyjnej, liczy wiersze i sprząta po sobie. `pg_dump` kończy się sukcesem także wtedy, gdy
plik da się później wczytać tylko częściowo — backup bez odtworzenia ma nieznaną wartość.
Ostatni przebieg (10.08.2026, baza demo): `Employee=23, Absence=49`, wynik OK.

## Bezpieczeństwo (NFR-5)

Hasła hashowane `scrypt`; dostęp przez JWT + RBAC. Zdarzenia bezpieczeństwa (nieudane logowania
`LOGIN_FAILED`, odmowy dostępu `ACCESS_DENIED`, odczyt znacznika L4 `VIEW_TYPES`) trafiają do
tabeli `AuditLog`. Szyfrowanie w tranzycie zapewnia Caddy (TLS); w spoczynku — dysk/Postgres
na poziomie wdrożenia. Nagłówki bezpieczeństwa: API przez `helmet()`, dokument SPA przez Caddy
(CSP, `X-Frame-Options`, `Referrer-Policy` — patrz `Caddyfile`).

**Token niesie wyłącznie tożsamość.** Rolę, uprawnienia rozszerzone i status zatrudnienia strażnik
czyta z bazy przy każdym żądaniu, więc odebranie uprawnienia, degradacja roli, zakończenie
współpracy i usunięcie konta działają natychmiast. Wcześniej uprawnienia jechały w tokenie, czyli
były kopią sprzed nawet dwunastu godzin — administrator reagujący na incydent nie miał czym
zareagować. Koszt: jedno zapytanie na żądanie, przy 300 użytkownikach z NFR-1 poniżej progu
zauważalności.

Wyjątek, o którym warto wiedzieć: anonimizacja (FR-J2) usuwa dane osobowe i hasło, ale wiersz
pracownika zostaje (integralność wpisów), więc token wydany **przed** anonimizacją działa do
wygaśnięcia. Ponowne zalogowanie jest niemożliwe. Domknięcie tego okna wymaga kolumny znacznika
sesji na `Employee` — patrz `NAPRAWY-PO-REVIEW.md`, sekcja „Do decyzji".

`VIEW_TYPES` obejmuje **obie** drogi, którymi znacznik kategorii szczególnej wychodzi z systemu:
listę wpisów (`GET /absences`) i eksport płacowy (`GET /reports/export/payroll`). Dodając trzecią,
dopisz do niej ten sam wpis audytu tą samą akcją — inaczej filtry dziennika pokażą część odczytów.

Podatności w zależnościach pilnuje `pnpm audit` w CI (próg „high", blokujący). Zależności transitive
przypinane są przez `pnpm.overrides` w `package.json`.

## Monitoring i dostępność (NFR-2)

`GET /api/health` to sonda dla monitoringu: **200** = aplikacja żyje i baza odpowiada
(`{status, db, uptimeSec, version}`), **503** = baza niedostępna. Ustaw alerty na kod ≠ 200 oraz czas
odpowiedzi. Adopcję mierzy `GET /api/analytics/adoption` (NFR-8) — panel „Analityka adopcji"
w Konfiguracji.

Tej samej sondy używa `healthcheck` kontenera `api` w `docker-compose.prod.yml`; `db` ma własny
(`pg_isready`), a `api` czeka na jego wynik przez `depends_on: condition: service_healthy`. Kontener
API startuje od `prisma migrate deploy`, więc bez tego warunku pierwsze uruchomienie wywracało się
na migracji i wstawało dopiero z restartu.

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
(zakazuje go dopiero **1.4.10 Reflow — wyłączone z deklaracji za zgodą zamawiającego z 10.08.2026**,
patrz `PRODUCT.md` i `WNIOSEK-ZAWEZENIE-NFR.md`).

Audyt powtórzysz bez dodatkowych narzędzi: `axe-core` jest devDependency `apps/web`, a serwer dev
podaje go pod `/node_modules/axe-core/axe.min.js`. W konsoli przeglądarki:

```js
axe.run(document, { preload: false, runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } }).then(r => console.table(r.violations))
```

Ten przebieg jest **ręczny** — automat w CI to `pnpm -F @nieobecnosci/web lint` (reguły `jsx-a11y`),
który łapie bariery widoczne statycznie w JSX. Pokrycia axe nie zastępuje i nie ma tego udawać.

**Uwaga przy zmianach w konfiguracji lintu:** `jsx-a11y/no-noninteractive-tabindex` ma dopisaną rolę
`region` (`apps/web/eslint.config.js`) i jest to celowe. Reguła domyślnie zabrania `tabIndex` na
elemencie nieinteraktywnym, a axe wymaga go dokładnie tam — przewijane siatki kalendarza i heatmapy
nie zawierają żadnej kontrolki, więc bez `tabIndex={0}` użytkownik klawiatury nie dosięgnie ich
prawej części (2.1.1). Usunięcie `tabIndex`, żeby „uciszyć lint", cofa naprawę z audytu i wyjdzie
dopiero przy kolejnym przebiegu axe.

## Stan i co dalej

**Zrobione:** całe MVP, Faza 2 (16 pozycji), część Fazy 3 — heatmapa pokrycia (C4), operacje masowe
(A10), kanały iCal (F4), powiadomienia in-app, scheduler, ekran „Zespół" (korekta wpisów przez lidera,
FR-A5), import .xlsx z konfigurowalnym mapowaniem kolumn (FR-G5/D4), automatyczne rolowanie urlopu
zaległego na przełomie okresu (FR-B7), zweryfikowana wydajność przy 300 użytkownikach (NFR-1),
audyt dostępności axe bez naruszeń (NFR-7), bramki jakości w CI i test odtworzenia backupu (NFR-4).

Stan każdej historyjki z backlogu odnotowuje kolumna **„Stan wdrożenia"** w
`Backlog - aplikacja nieobecnosci.xlsx` — 74 historyjki, przegląd kodu z 10.08.2026. To wersja
śledzona; `.docx` jest pierwotnym wydaniem bez tej kolumny.

**Przegląd kodu 10.08.2026** potwierdził, że backlog nie zawyża stanu, i domknął trzy rzeczy, których
backlog nie widział: brak wpisu audytu przy odczycie kategorii szczególnej w eksporcie płacowym,
`GET /pools/default` bez kontroli roli oraz `GET /absences` bez `employeeId` zwracające adminowi
wszystkie wpisy wszystkich osób. Wniosek na przyszłość: stan czytaj z kodu i z kolumny „Stan
wdrożenia", nie z prozy w tym pliku.

**Świadomie niezrobione** — do decyzji przed produkcją:

- Integracje: **AD/SSO** (jest przygotowany szew `AuthProvider`, brak implementacji OIDC), TETA, JIRA.
- **NFR-9** — interfejs EN dla współpracowników OUT (priorytet „Could", potrzeba nierozstrzygnięta).
- **NFR-2** — progi i alerty monitoringu: aplikacja daje sondę `/api/health`, resztę konfiguruje się
  w monitoringu organizacji.
- **NFR-6** poza pulpitem i wpisem — pozostałe dziewięć ekranów zakłada stację roboczą.
  Zawężenie **zatwierdzone przez Credit Agricole 10.08.2026** (`WNIOSEK-ZAWEZENIE-NFR.md`),
  więc to uzgodniony zakres, nie dług.
- **1.4.10 Reflow** — wyłączone z deklaracji WCAG tą samą decyzją. Pozostałe kryteria AA obowiązują.
- Układ kolumn plików importu do ustalenia z zamawiającym (na razie mapowanie konfigurowalne).
- Hasło startowe `admin/admin` — zmienić przy pierwszym wdrożeniu.

**Znane braki jakościowe** — nie są długiem wobec zamawiającego (żadne wymaganie ich nie żąda), ale są
ryzykiem i lepiej, żeby ktoś nie odkrywał ich audytem po raz drugi:

- **Zero testów frontendu.** `apps/web` nie ma skryptu `test`; 49 plików chroni `tsc --noEmit`
  i lint `jsx-a11y`. Pierwszy sensowny test to `Wpis.tsx` — walidacja i budżet trzech kliknięć.
- **Audyt axe tylko ręcznie.** Automatyzacja wymaga headless browsera i zalogowanej sesji na 12 tras.
- **Kopia off-site backupu zakomentowana** w `scripts/nieobecnosci-backup.service`. Bez niej RPO ginie
  razem z maszyną — sam komentarz w pliku to przyznaje.
- **Obraz API jednoetapowy** (`apps/api/Dockerfile`): źródła, devDeps i cache pnpm jadą na produkcję.
- **Brak testów jednostkowych API.** Serwisy weryfikują wyłącznie suity end-to-end.
