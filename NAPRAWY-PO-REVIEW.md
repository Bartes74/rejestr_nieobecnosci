# Plan naprawy — `rejestr_nieobecnosci`

> Plik roboczy. Po ukończeniu każdej części zaznacz `[x]` i dopisz notatkę w sekcji **Dziennik postępu** na końcu.

## Kontekst

Kompleksowy code review repozytorium wykazał 3 błędy krytyczne, 6 poważnych, 8 średnich i garść drobnych. Trzy z nich uderzają w fundament produktu:

1. **Obejście puli urlopu i trwałe zepsucie salda** — `dayPart: "HOURS"` bez walidacji godzin daje ułamek dnia `0` (darmowy urlop) albo `NaN` (saldo pracownika psuje się na stałe, a każda kolejna walidacja puli przepuszcza wszystko).
2. **Obejście ochrony L4 i dziennika audytu** — `feedToken` wycieka z `GET /api/employees`, a trasa `@Public()` `/feed/me.ics?token=` oddaje nazwy typów nieobecności. Dyrektor, PMO i posiadacz `MODIFY_ABSENCE` czytają cudze L4 bez uprawnienia `VIEW_L4` i bez śladu w audycie.
3. **Anonimizacja RODO nie działa do końca** — `feedToken` przeżywa `anonymize()`, więc stary link iCal dalej oddaje pełną historię osoby, która skorzystała z prawa do bycia zapomnianym.

Celem jest domknięcie wszystkich znalezisk bez naruszania tego, co w repozytorium jest dobre: czystej logiki domenowej w `packages/core`, konsekwentnej dyscypliny stref czasowych i ochrony L4 „z konstrukcji".

### Ustalenia z rozmowy

| Decyzja | Wybór | Konsekwencja dla planu |
|---|---|---|
| Stan bazy | tylko dev/demo | **Brak migracji naprawczej danych.** Uszkodzone wpisy znikną przy `db-wipe` / `demo-seed`. |
| Unieważnianie sesji (P1) | odczyt z bazy w guardzie | Bez migracji schematu. Token niesie wyłącznie tożsamość; rola i uprawnienia z bazy przy każdym żądaniu. |
| Infrastruktura | w zakresie | Caddy, rola Postgresa dla audytu, `.dockerignore`, `backup.sh`. |
| Front-end | pełny zakres | Strażnik wyścigu w podglądzie **oraz** UI edycji godzin. |

**Żadna zmiana nie wymaga migracji schematu Prismy.** Jedyny SQL to jednorazowy skrypt roli bazodanowej (Część 8).

> **Dopisek z 11.08.2026, po zamknięciu Części 1–9.** Powyższe dotyczy Części 1–9. Doszła
> **Część 10** — zamknięcie sesji przy anonimizacji i resecie hasła — i ona migracji wymaga:
> to jedyna luka, której nie da się domknąć bez trwałego znacznika w bazie. Plan niżej.

### Konwencje repozytorium, których trzymamy się bez wyjątku

- **Testy integracyjne**: `apps/api/verify-*.mjs`, każdy samowystarczalny, z lokalną kopią helperów `ok/j/login/as`, własnym prefiksem loginów, hasłem `haslo123`, health-waitem na starcie i stopką `process.exit(failures === 0 ? 0 : 1)`. Nową suitę **trzeba ręcznie dopisać** do `SUITES` w [`apps/api/run-verify.mjs:9`](apps/api/run-verify.mjs).
- **Testy jednostkowe**: vitest w `packages/core/src/*.test.ts`.
- **Komentarze**: po polsku, tłumaczą *decyzję*, nie kod. Odwołanie do wymagania (`FR-…`, `NFR-…`) tam, gdzie zmiana dotyczy wymagania.
- **Świadome uproszczenia** oznaczaj komentarzem `ponytail:` z nazwanym sufitem i drogą wyjścia.

---

## Część 1 — K1: walidacja wpisów godzinowych

**Problem.** `dayFraction('HOURS', undefined, undefined) === 0`, `dayFraction('HOURS', 'abc', 'def') === NaN`. Brak godzin → dzień nieobecności nie kosztujący puli. Śmieci w godzinach → `used = NaN` → `usedAfter > available` jest `false` (walidacja przepuszcza), a saldo osoby zwraca `null` w JSON już na zawsze.

- [x] **1.1 — zacisk u źródła.** [`packages/core/src/workdays.ts:23`](packages/core/src/workdays.ts) — `dayFraction` nigdy nie może zwrócić `NaN` ani wartości spoza `0..1`:
  ```ts
  const raw = (toMin(hourTo) - toMin(hourFrom)) / (workdayHours * 60);
  return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
  ```
  Komentarz: ułamek dnia z definicji mieści się w `0..1`; wpuszczenie `NaN` do `countOverlaidDays` zatruwa całą sumę, a `Math.min(1, NaN)` to `NaN`.

- [x] **1.2 — format w DTO.** [`apps/api/src/dto.ts`](apps/api/src/dto.ts) — `@Matches(/^([01]\d|2[0-3]):[0-5]\d$/)` na `hourFrom`/`hourTo` w `CreateAbsenceDto` i `BulkCreateAbsenceDto` (oraz w `UpdateAbsenceDto` z Części 2). Komunikat po polsku, bo trafia wprost do użytkownika przez `errorMessage()` w [`apps/web/src/api.ts:28`](apps/web/src/api.ts).

- [x] **1.3 — strażnik przy zapisie.** [`apps/api/src/absences.service.ts:289`](apps/api/src/absences.service.ts) `validate()` — jedno miejsce, przez które przechodzą `create` i `update`:
  ```ts
  if (dayPart === 'HOURS' && !(hourFrom && hourTo && hourTo > hourFrom)) {
    throw new BadRequestException('Wpis godzinowy wymaga zakresu godzin, w którym koniec jest późniejszy niż początek.');
  }
  ```
  Reguła świadomie **nie** dotyczy `preview()` — to `GET` wołany przy każdym naciśnięciu klawisza, więc ma pokazywać zero dni, a nie sypać błędem. Blokadę przycisku zapewnia już `badHours` w [`Wpis.tsx:182`](apps/web/src/screens/Wpis.tsx), a `create` odrzuci żądanie niezależnie od klienta.

- [x] **1.4 — testy jednostkowe.** [`packages/core/src/workdays.test.ts`](packages/core/src/workdays.test.ts): `HOURS` bez godzin → `0`; zakres odwrócony → `0`; śmieci → `0` (nie `NaN`); `00:00–23:59` → `1` (zacisk); `09:00–13:00` → `0.5`.

- [x] **1.5 — suita regresji.** Nowy `apps/api/verify-godziny-walidacja.mjs` (prefiks loginów `gw`), rejestracja w `run-verify.mjs`. Asercje:
  - `POST /absences {dayPart:'HOURS'}` bez godzin → `400`
  - `hourFrom:'17:00', hourTo:'09:00'` → `400`
  - `hourFrom:'abc'` → `400` (walidacja DTO)
  - poprawny `09:00–13:00` → `201`, a `GET /employees/:id/balance` zwraca **liczbę**, nie `null` — to asercja pilnująca konkretnie regresji `NaN`
  - dwadzieścia prób wpisu `HOURS` bez godzin nie zmienia salda

**Definicja ukończenia:** nie istnieje żądanie HTTP tworzące wpis nieobecności o ułamku dnia `0` lub `NaN`.

---

## Część 2 — P3: godziny w `PATCH /absences/:id`

**Problem.** [`dto.ts:104`](apps/api/src/dto.ts) nie ma `hourFrom`/`hourTo`, a `ValidationPipe({ whitelist: true })` je wycina; [`absences.service.ts:159`](apps/api/src/absences.service.ts) nigdy ich nie zapisuje. Godzin nie da się poprawić (cicha porażka), a `PATCH {dayPart:'HOURS'}` na wpisie całodniowym zostawia je puste — czyli otwiera K1 tylnymi drzwiami.

- [x] **2.1** Dopisz `hourFrom`/`hourTo` do `UpdateAbsenceDto` (z `@Matches` z kroku 1.2).
- [x] **2.2** W `update()` jedna reguła: **godziny istnieją wyłącznie dla wpisów `HOURS`**.
  ```ts
  const dayPart = dto.dayPart ?? existing.dayPart;
  const hourFrom = dayPart === 'HOURS' ? (dto.hourFrom ?? existing.hourFrom) : null;
  const hourTo   = dayPart === 'HOURS' ? (dto.hourTo   ?? existing.hourTo)   : null;
  ```
  Przekaż do `validate()` (dziś dostaje `existing.*`, co jest źródłem błędu) **i** zapisz w `data:`.
- [x] **2.3** Asercje w suicie z 1.5: `PATCH {dayPart:'HOURS'}` na wpisie całodniowym → `400`; `PATCH {hourFrom, hourTo}` faktycznie zmienia wartości w odpowiedzi; `PATCH {dayPart:'FULL'}` na wpisie godzinowym zeruje godziny.

---

## Część 3 — K2 + K3: `feedToken` i anonimizacja

- [x] **3.1 — jedno miejsce prawdy dla pól ukrywanych.** W [`apps/api/src/employees.service.ts`](apps/api/src/employees.service.ts) (albo osobny `employee-fields.ts`, jeśli czytelniej):
  ```ts
  /** Pola, które nigdy nie opuszczają API: hash hasła i token subskrypcji kanału iCal
   *  (ten drugi działa jak hasło — `/feed/me.ics?token=` jest trasą publiczną). */
  export const HIDDEN_EMPLOYEE_FIELDS = { passwordHash: true, feedToken: true } as const;
  ```
  Podstaw we **wszystkich** `omit:` zwracających pracownika — [`employees.controller.ts:33`](apps/api/src/employees.controller.ts) (ścieżka wycieku), `employees.service.create`, `changeEmploymentType`, `changeRole`, oraz `setPassword`, które dziś nie ma `omit` w ogóle i zwraca `passwordHash` (kontroler go odrzuca, ale to przypadek, nie zabezpieczenie).
  Nie dotyczy [`calendar-feed.controller.ts:20`](apps/api/src/calendar-feed.controller.ts) `myToken` — tam oddanie **własnego** tokenu jest celem endpointu.

- [x] **3.2 — K3: `feedToken: null` w `anonymize()`.** [`employees.service.ts:107`](apps/api/src/employees.service.ts). Komentarz: token subskrypcji przeżywający anonimizację oddaje pełną historię przez trasę publiczną, więc żądanie usunięcia danych (FR-J2) go nie obejmowało. Automatycznie naprawia też retencję, która woła tę samą metodę.

- [x] **3.3 — suita regresji.** Nowy `apps/api/verify-rodo-feedtoken.mjs` (prefiks `ft`). Suita tworzy `ftadmin` (ADMIN), `ftdyr` (DIRECTOR), `ftpmo` (PMO), `ftmod` (EMPLOYEE + `Permission{MODIFY_ABSENCE}`) i `ftanna` (EMPLOYEE z wpisem L4). Asercje:
  - dla każdej z czterech uprzywilejowanych ról: `GET /employees` → `rows.every((e) => e.feedToken === undefined)` **oraz** `e.passwordHash === undefined`
  - `ftanna` pobiera swój token przez `/me/feed-token`, po czym `POST /employees/:id/anonymize` → ten sam `GET /feed/me.ics?token=` zwraca `404`
  - wzorzec asercji „pole nie wyciekło" jak w [`verify-faza3-feed.mjs:30`](apps/api/verify-faza3-feed.mjs) i [`verify-mvp-h4-j2.mjs:43`](apps/api/verify-mvp-h4-j2.mjs)
  - rejestracja w `SUITES`

---

## Część 4 — P1: unieważnianie sesji

**Problem.** JWT niesie `role` i `permissions` przez 12 h. Odebranie uprawnień, zmiana roli i anonimizacja działają z opóźnieniem do 12 h. `endDate` sprawdzany jest przy zapisie nieobecności ([`absences.service.ts:301`](apps/api/src/absences.service.ts)), ale nie przy logowaniu — były pracownik loguje się normalnie.

**Podejście:** token nosi wyłącznie tożsamość (`sub`); rola, uprawnienia i status zatrudnienia pochodzą z bazy przy każdym żądaniu. `PrismaService` jest już wstrzyknięty w `AuthGuard`, więc nie dochodzi żadna zależność.

- [x] **4.1** [`auth.service.ts:36`](apps/api/src/auth/auth.service.ts) — payload tokenu ograniczony do `{ sub: emp.id }`; `verify()` zwraca `{ sub: string }` zamiast `AuthUser`. Komentarz: uprawnienia w tokenie to kopia, która nie da się unieważnić.
- [x] **4.2** [`auth.guard.ts:27`](apps/api/src/auth/auth.guard.ts) — po weryfikacji podpisu doczytaj pracownika i zbuduj `AuthUser`:
  ```ts
  const { sub } = this.auth.verify(token);
  const emp = await this.prisma.employee.findUnique({
    where: { id: sub },
    select: { id: true, role: true, endDate: true, permissions: { select: { scope: true } } },
  });
  if (!emp) throw new UnauthorizedException('Konto nie istnieje.');
  if (emp.endDate && emp.endDate < todayUtc()) throw new UnauthorizedException('Współpraca zakończona.');
  req.user = { sub: emp.id, role: emp.role, permissions: emp.permissions.map((p) => p.scope) };
  ```
  `todayUtc()` z `@nieobecnosci/core`, nie `new Date()` — z tego samego powodu co w [`balance.service.ts:120`](apps/api/src/balance.service.ts).
  Komentarz `ponytail:` — jedno zapytanie na żądanie; przy 300 użytkownikach z NFR-1 bez znaczenia, przy większej skali wchodzi cache z krótkim TTL unieważniany przy zmianie uprawnień.
- [x] **4.3** Ten sam warunek `endDate` w [`auth-provider.ts:17`](apps/api/src/auth/auth-provider.ts) — logowanie ma odmawiać od razu, a nie wydawać token bezużyteczny przy pierwszym żądaniu.
- [x] **4.4** Sprawdź, czy `AuthUser` nie jest nigdzie budowany z tokenu z pominięciem guarda. `SYSTEM` w [`scheduler.service.ts:10`](apps/api/src/scheduler.service.ts) to obiekt in-process — zostaje bez zmian.
- [x] **4.5** Nowa suita `apps/api/verify-sesja-uniewaznienie.mjs` (prefiks `su`): token wydany → admin odbiera `MODIFY_ABSENCE` → **to samo żądanie tym samym tokenem** → `403`; token wydany → `anonymize` → `401`; pracownik z `endDate` w przeszłości → logowanie `401`. Rejestracja w `SUITES`.

---

## Część 5 — P2 + P4: przypomnienia i wyścig zapisu

- [x] **5.1 — P2: przypomnienia liczone tak samo jak licznik.** [`notifications.service.ts:37`](apps/api/src/notifications.service.ts) filtruje `carriedOver: { gte: … }` na kolumnie nullowalnej, a `null` to **udokumentowany przypadek domyślny** ([`schema.prisma:162`](prisma/schema.prisma), [`pools.controller.ts:50`](apps/api/src/pools.controller.ts)). W SQL `NULL >= 1` daje `NULL`, więc cały FR-E3 działa wyłącznie dla ręcznych korekt.
  Przepisz na `BalanceService.current()` — to samo źródło, którego używa feed in-app ([`notifications-feed.controller.ts:30`](apps/api/src/notifications-feed.controller.ts)), żeby ta sama reguła nie miała dwóch prawd. Wstrzyknij `BalanceService` (brak cyklu: zależy tylko od `PrismaService`). Pomiń osoby po `endDate` i zanonimizowane (`login` z prefiksem `anon-` — adres `@example.invalid` i tak by odbił).
  `ponytail:` — pętla po pracownikach zamiast zapytania wsadowego; zadanie nocne przy kilkuset osobach, przy tysiącach przejść na wzorzec wsadowy z [`reports.service.ts:44`](apps/api/src/reports.service.ts).
- [x] **5.2 — suita.** `apps/api/verify-przypomnienia-zalegle.mjs` (prefiks `pz`): osoba z **wyliczonym** (nie ustawionym ręcznie) zaległym urlopem dostaje przypomnienie — dziś ten test pada. Wzorzec danych z [`verify-b7-rolowanie.mjs`](apps/api/verify-b7-rolowanie.mjs), sprawdzenie wysyłki przez wpis `EMAIL_SENT` w dzienniku jak w [`verify-faza2-email.mjs`](apps/api/verify-faza2-email.mjs). Rejestracja w `SUITES`.
- [x] **5.3 — P4: szeregowanie zapisów per pracownik.** Między `validate()` a `create()` w [`absences.service.ts:112`](apps/api/src/absences.service.ts) nie ma transakcji ani blokady — dwa równoległe żądania przechodzą walidację niezależnie i oba zapisują, przekraczając pulę. Dodaj prywatny szeregownik promisów kluczowany `employeeId` i owiń nim `create()` oraz `update()`; zwalniaj wpis z mapy, gdy łańcuch się kończy (inaczej mapa rośnie z każdym pracownikiem).
  ```ts
  // ponytail: kolejkowanie w procesie — API działa w jednej instancji (docker-compose.prod.yml).
  // Przy skalowaniu poziomym zastąpić blokadą wiersza: $transaction + SELECT … FOR UPDATE.
  ```
- [x] **5.4** Asercja w suicie z 1.5: `Promise.all` z pięcioma żądaniami wyczerpującymi pulę → dokładnie tyle zapisów, ile pula pozwala, reszta `400`.

---

## Część 6 — poprawki średnie (backend)

- [x] **6.1 — S1: enumeracja użytkowników.** [`auth-provider.ts:17`](apps/api/src/auth/auth-provider.ts) — nieistniejący login wraca natychmiast, istniejący po ~100 ms scrypt. Licz hash zawsze, na stałym haszu-atrapie liczonym raz przy starcie modułu.
- [x] **6.2 — S2: scrypt poza pętlą zdarzeń.** `verifyPassword` ma **jednego** wywołującego (`LocalAuthProvider`), więc przejście na `scrypt` asynchroniczny to zmiana lokalna. `hashPassword` zostaje synchroniczny — używają go seedy i 30 suit `verify-*.mjs` w kontekście synchronicznym, a nie leży na ścieżce gorącej.
- [x] **6.3 — S3: import pracowników nie może paść w połowie.** [`employees.service.ts:161`](apps/api/src/employees.service.ts) — `create`/`update` poza `try/catch`, więc duplikat loginu w pliku daje `500` z częścią wierszy już zapisanych i zerowym raportem. Owiń w `try/catch` i dopisuj do istniejącej struktury `result.errors` (jest gotowa, tylko nieużywana na tej ścieżce).
- [x] **6.4 — S4: współbieżność w `/capacity/matrix`.** [`capacity.controller.ts:57`](apps/api/src/capacity.controller.ts) — `Promise.all` po maks. 240 komórkach × ~4 zapytania to ~1000 równoległych zapytań przy puli połączeń Prismy rzędu kilkunastu. Limit 240 ogranicza rozmiar, nie współbieżność. Przetwarzaj partiami (np. po 8) z komentarzem `ponytail:` nazywającym sufit; drogą wyjścia jest pobranie danych raz per jednostka i policzenie sprintów w pamięci.
- [x] **6.5 — S5: podwójny odczyt tej samej tabeli.** [`org.service.ts:50`](apps/api/src/org.service.ts) — `tribePeers` woła `scopeUnitIds` (pełny odczyt `orgUnit` + `orgUnitMembership`), po czym czyta `orgUnitMembership` **drugi raz**. Niech `scopeUnitIds` zwraca też wczytane członkostwa.
- [x] **6.6 — S7: `convertToL4`.** [`absences.service.ts:229`](apps/api/src/absences.service.ts) — sprawdza tylko `canModifyOthers`, więc lider nie skonwertuje wpisu swojego Tribe, a posiadacz `MODIFY_ABSENCE` skonwertuje wpis dowolnej osoby w firmie. Zamień na: odmowa dla własnego wpisu (oznaczenie L4 to czynność osoby uprawnionej, nie samego zainteresowanego), a poza tym zwykłe `assertCanActFor`. Do tego `findFirst` po typie L4 dostaje `orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]` — dziś przy dwóch pasujących typach wynik zależy od kolejności w bazie.
- [x] **6.7 — audyt zmiany typu nieobecności.** [`absence-types.controller.ts:31`](apps/api/src/absence-types.controller.ts) podaje `dto` wprost do Prismy. Przestawienie `affectsPool` istniejącego typu przelicza historię wszystkich (dzień urlopu staje się „przykrywającym") bez śladu w dzienniku. Dopisz wpis audytu, gdy zmiana dotyczy `affectsPool`, `affectsCapacity` lub `specialCategory`.
- [x] **6.8 — import sprintów bez duplikatów.** [`sprints.service.ts:64`](apps/api/src/sprints.service.ts) — powtórny import mnoży sprinty. Upsert po `(name, dateFrom)` albo pominięcie istniejących z raportem, spójnie z `skipDuplicates` w [`holidays.controller.ts:45`](apps/api/src/holidays.controller.ts).

---

## Część 7 — front-end

- [x] **7.1 — S6: strażnik nieaktualnej odpowiedzi w podglądzie.** [`Wpis.tsx:197`](apps/web/src/screens/Wpis.tsx) — `api.preview(...).then(setPreview)` bez zabezpieczenia, a przycisk zapisu jest blokowany przez `preview?.collision`, więc spóźniona odpowiedź potrafi odblokować zapis dla innego terminu niż widoczny. Zastosuj wzorzec `let live = true` obecny już w [`Kalendarz.tsx:89`](apps/web/src/screens/Kalendarz.tsx).
- [x] **7.2 — typ w kliencie API.** [`api.ts:145`](apps/web/src/api.ts) — `updateAbsence` przyjmuje `dayPart`, `hourFrom`, `hourTo`.
- [x] **7.3 — UI edycji godzin.** Formularze edycji w [`Historia.tsx:57`](apps/web/src/screens/Historia.tsx) i [`Zespol.tsx:85`](apps/web/src/screens/Zespol.tsx) wysyłają dziś tylko daty (i typ). Dodaj wybór `dayPart` oraz pola godzinowe widoczne wyłącznie dla `HOURS`, z tą samą walidacją klienta co `badHours` w `Wpis.tsx`. Kontrolki i style bierz z istniejącego formularza w `Wpis.tsx` — nie twórz nowych wariantów.
- [x] **7.4 — a11y.** Nowe pola przechodzą `pnpm -F @nieobecnosci/web lint` (bramka `jsx-a11y` w CI). Zachowaj wzorzec `<label>` + `aria-invalid` z `Wpis.tsx:294`.

---

## Część 8 — infrastruktura i wdrożenie

- [x] **8.1 — P5: nagłówki bezpieczeństwa na SPA.** `helmet()` obejmuje tylko API ([`main.ts:23`](apps/api/src/main.ts)); HTML serwuje Caddy bez CSP i bez `X-Frame-Options`, a token siedzi w `localStorage`. Dodaj blok `header` w [`Caddyfile`](Caddyfile): `Content-Security-Policy` (`default-src 'self'`, `frame-ancestors 'none'`, `style-src 'self' 'unsafe-inline'` — React używa atrybutów `style`, fonty są własne w `public/fonts/`), `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy no-referrer`, `-Server`.
  **Weryfikacja obowiązkowa:** po zmianie otwórz aplikację i sprawdź konsolę — CSP blokujące bundle Vite to awaria całego frontu, nie kosmetyka.
- [x] **8.2 — S8: audyt naprawdę append-only.** [`schema.prisma:212`](prisma/schema.prisma) deklaruje dziennik niemodyfikowalny, ale to konwencja w kodzie — aplikacja łączy się jako właściciel schematu, więc `DELETE FROM "AuditLog"` przechodzi.
  - `scripts/db-appuser.sql`: rola `nieobecnosci_app`, `GRANT` na wszystko, `REVOKE UPDATE, DELETE ON "AuditLog"`, plus `ALTER DEFAULT PRIVILEGES` dla właściciela, żeby przyszłe tabele dostawały uprawnienia automatycznie.
  - Rozdziel poświadczenia: `DATABASE_URL` (aplikacja, rola ograniczona) i `MIGRATE_DATABASE_URL` (właściciel, tylko migracje). W `apps/api/Dockerfile` `CMD` uruchamia `prisma migrate deploy` z URL-em właściciela, aplikację z URL-em ograniczonym.
  - Uzupełnij [`.env.prod.example`](.env.prod.example) i sekcję wdrożeniową w [`README.md`](README.md) o jednorazowy krok utworzenia roli.
- [x] **8.3 — obrazy Dockera.** [`.dockerignore`](.dockerignore) nie wyklucza dokumentów wymagań (`.docx`/`.pptx`/`.xlsx`/`.html`, ~1,5 MB, w tym plik z prawami `-rw-------`) ani `db-wipe.mjs`. Rozszerz listę.
  *Odłożone świadomie:* multi-stage dla API. `CMD` woła `pnpm exec prisma migrate deploy`, a CLI `prisma` jest zależnością deweloperską — przycięcie devDependencies złamałoby start kontenera. Przeniesienie go do `dependencies` albo `pnpm deploy --prod` to osobne zadanie; sam `.dockerignore` zdejmuje właściwe ryzyko (dokumenty wewnętrzne w obrazie).
- [x] **8.4 — `backup.sh`.** [`scripts/backup.sh:13`](scripts/backup.sh) — `pg_dump | gzip > "$OUT"` tworzy plik, zanim wiadomo, czy dump się udał; przy błędzie zostaje obcięty plik wyglądający jak backup, a `set -e` przerywa przed retencją. Pisz do `"$OUT.tmp"`, `mv` dopiero po sukcesie.

---

## Część 9 — porządki i weryfikacja końcowa

- [x] **9.1** Rozdziel [`analytics.controller.ts`](apps/api/src/analytics.controller.ts) na serwis i kontroler, zgodnie z resztą repozytorium. Popraw dwa providery/kontrolery w jednej linii w [`app.module.ts:68,85`](apps/api/src/app.module.ts).
- [x] **9.2** Zaktualizuj [`README.md`](README.md) (macierz RBAC — token nie niesie już uprawnień; nowy krok wdrożeniowy z Części 8.2) i [`HANDOFF.md`](HANDOFF.md) (nowe suity na liście).
- [x] **9.3 — pełna weryfikacja** (kolejność obowiązkowa, patrz sekcja niżej).

---

## Weryfikacja

Bramki są te same, które ma CI ([`.github/workflows`](.github/workflows)) — przebieg lokalny musi je odtworzyć w całości.

**1. Offline (bez bazy):**
```bash
pnpm run verify:offline
```
`build` + `typecheck` + vitest `packages/core`. Tu wychodzą 1.1, 1.4 i wszystkie zmiany typów z Części 4.

**2. Lint dostępności** (bramka blokująca w CI, dotyczy Części 7):
```bash
pnpm -F @nieobecnosci/web lint
```

**3. Audyt zależności:**
```bash
pnpm audit --prod --audit-level high
```

**4. Suity integracyjne** — wymagają bazy i działającego API. Runner **czyści bazę na starcie**, więc nie odpalaj go na niczym, co chcesz zachować:
```bash
pnpm db:up
pnpm exec prisma migrate deploy
PORT=3100 node apps/api/dist/main.js &
API=http://localhost:3100/api pnpm run verify:suites
```
Oczekiwane: `✅ Wszystkie 34 suit OK` (30 istniejących + 4 nowe). Każda z nowych suit musi paść na kodzie sprzed poprawki i przejść po — sprawdź to, zanim uznasz część za ukończoną. Suita, która przechodzi w obie strony, nie testuje niczego.

**5. Weryfikacja w przeglądarce** (Części 7 i 8.1) — przez `preview_start`, nie ręcznie:
- konsola bez błędów CSP po zmianie w `Caddyfile` (blokada bundla Vite = awaria całego frontu)
- `GET /api/employees` w zakładce sieci nie zawiera `feedToken` ani `passwordHash`
- edycja godzin w Historii: zmiana zakresu zapisuje się i zmienia liczbę dni w saldzie
- wpis godzinowy z odwróconym zakresem blokuje przycisk zapisu, a wysłany mimo to (przez konsolę) wraca `400`

**6. Kontrola ręczna, której testy nie złapią:**
```bash
docker build -f apps/api/Dockerfile -t nieobecnosci-api . && docker run --rm nieobecnosci-api ls /app
```
— w obrazie nie ma dokumentów wymagań (Część 8.3).

---

## Kolejność i zależności

Części 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Twarde zależności:

- **2 wymaga 1** — strażnik `validate()` z 1.3 jest tym, co domyka tylną furtkę `PATCH`.
- **7.2/7.3 wymaga 2** — API musi przyjmować godziny w `PATCH`, zanim UI zacznie je wysyłać.
- **4 przed 5.1** — po zmianie guarda `AuthUser` powstaje w innym miejscu; przepisywanie przypomnień wcześniej oznacza dotykanie tego samego kodu dwa razy.
- Części 6 i 8 są niezależne — można je przestawić, jeśli coś pilniejszego wejdzie w drogę.

Po każdej części: `pnpm run verify:offline` + odpowiednia suita. Pełny przebieg dopiero w 9.3. Commit per część, na osobnej gałęzi (`naprawy-po-review`), nie na `main`.

---

## Świadomie poza zakresem

| Rzecz | Powód |
|---|---|
| Migracja naprawcza danych dla K1 | Baza tylko dev/demo — `db-wipe` / `demo-seed` załatwia sprawę. **Gdyby wdrożenie ruszyło przed naprawą, wraca do zakresu** jako migracja z `UPDATE`, wzorem [`20260811000000_audit_subject`](prisma/migrations/20260811000000_audit_subject/migration.sql). |
| Multi-stage build API | Patrz 8.3 — kolizja z `prisma` jako zależnością deweloperską. Osobne zadanie. |
| Ograniczenie `CHECK` na `Absence` dla godzin | Strażnik w `validate()` pokrywa wszystkie ścieżki HTTP, a jedynym pisarzem są aplikacja i seedy. Do rozważenia, gdyby pojawił się drugi zapisujący. |
| Wyniesienie helperów suit `verify-*.mjs` do wspólnego modułu | ~136 skopiowanych definicji w 30 plikach. Realny dług, ale refaktor 30 plików w trakcie naprawy błędów bezpieczeństwa miesza dwie zmiany w jednym przebiegu. Osobne zadanie. |
| Rotacja `feedToken` po naprawie K2 | Baza dev/demo — nie ma czego rotować. Przy realnych danych: jednorazowy `UPDATE "Employee" SET "feedToken" = NULL` (tokeny odtworzą się leniwie przy pierwszym żądaniu). |

---

## Część 10 — zamknięcie sesji przy anonimizacji i resecie hasła

> Osobny plan, dopisany po zamknięciu Części 1–9. Zamyka jedyną lukę, którą tamten przebieg
> zostawił świadomie otwartą (patrz „Do decyzji" niżej — sekcja rozstrzygnięta).

### Kontekst

Po Części 4 token niesie wyłącznie tożsamość, a rolę, uprawnienia i `endDate` strażnik czyta
z bazy przy każdym żądaniu — odebranie uprawnienia, degradacja roli, zakończenie współpracy
i usunięcie konta działają natychmiast. Jedno zdarzenie przez tę siatkę przechodzi:

**anonimizacja (FR-J2) nie zamyka trwającej sesji.** [`anonymize()`](apps/api/src/employees.service.ts)
zeruje dane osobowe, hasło i `feedToken`, ale **nie usuwa wiersza pracownika** — i słusznie, bo
trzyma integralność wpisów nieobecności. Strażnik taki wiersz znajduje i wpuszcza dalej. Ponowne
zalogowanie jest niemożliwe (brak hasła), ale token wydany **przed** anonimizacją działa do
wygaśnięcia, czyli do 12 godzin. Na ścieżce RODO to znaczy, że przez pół doby po realizacji
prawa do bycia zapomnianym ktoś może nadal czytać dane w aplikacji.

Ta sama luka dotyczy resetu hasła przez administratora: `PUT /employees/:id/password` odbiera
możliwość zalogowania, ale nie kończy sesji już trwających — czyli mija się z celem, gdy powodem
resetu jest podejrzenie przejęcia konta.

**Rozstrzygnięcie:** dedykowana kolumna znacznika sesji (migracja schematu, świadomie
dopuszczona teraz), obejmująca oba zdarzenia. Odrzucone warianty i ich koszty — w sekcji
„Do decyzji" niżej, zostawionej jako zapis rozumowania.

### Projekt

Kolumna `sessionsValidFrom DateTime?` na `Employee`. Znaczenie dosłowne: **tokeny wydane przed
tą chwilą są nieważne**. `null` (domyślnie) = nigdy nie unieważniano, czyli zachowanie dzisiejsze.

Porównanie idzie po `iat`, które JWT już niesie (sprawdzone: payload realnego tokenu to
`{"sub":…,"iat":…,"exp":…}`) — nie trzeba więc niczego dokładać do tokenu ani zmieniać jego formatu.

- [x] **10.1 — migracja.** `prisma/migrations/20260811120000_sessions_valid_from/migration.sql`,
  pisana ręcznie, z komentarzem prozą wyjaśniającym decyzję — jak
  [`20260811000000_audit_subject`](prisma/migrations/20260811000000_audit_subject/migration.sql).
  ```sql
  ALTER TABLE "Employee" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);
  -- Konta zanonimizowane wcześniej dostają znacznik z chwili anonimizacji — dziennik audytu
  -- ją zna, więc nie ma powodu zostawiać ich z sesjami ważnymi „od zawsze".
  UPDATE "Employee" e SET "sessionsValidFrom" = a.ts
  FROM (SELECT "subjectId", max("timestamp") AS ts FROM "AuditLog"
        WHERE action = 'ANONYMIZE' AND "subjectId" IS NOT NULL GROUP BY "subjectId") a
  WHERE e.id = a."subjectId";
  ```
  Kolumna, nie tabela — **`scripts/db-appuser.sql` nie wymaga ponownego uruchomienia** (uprawnienia
  nadawane są na tabele, nie na kolumny).

- [x] **10.2 — schemat.** Pole w [`prisma/schema.prisma`](prisma/schema.prisma), model `Employee`,
  z jednozdaniowym komentarzem po polsku w konwencji pozostałych pól (`feedToken`, `isKeyRole`).

- [x] **10.3 — `verify()` oddaje moment wydania.** [`auth.service.ts:47`](apps/api/src/auth/auth.service.ts)
  — typ zwracany `{ sub: string; iat: number }`. Przy okazji: linia 5 importuje `AuthUser`, którego
  ten plik już nie używa (pozostałość po Części 4) — do usunięcia.

- [x] **10.4 — strażnik.** [`auth.guard.ts:35`](apps/api/src/auth/auth.guard.ts) — dołóż
  `sessionsValidFrom` do `select` i warunek tuż za sprawdzeniem `endDate`:
  ```ts
  // `iat` jest w pełnych sekundach, więc token wydany w tej samej sekundzie, w której
  // unieważniono sesje, wypadałby po jednej albo drugiej stronie granicy zależnie od
  // milisekund. Granicę zaokrąglamy w górę: sesja z tej samej sekundy zawsze przepada.
  if (emp.sessionsValidFrom && iat < Math.ceil(emp.sessionsValidFrom.getTime() / 1000)) {
    throw new UnauthorizedException('Sesja została zakończona. Zaloguj się ponownie.');
  }
  ```
  Front i tak pokazuje własny komunikat przy 401 ([`api.ts:57`](apps/web/src/api.ts)), więc treść
  służy logom, nie użytkownikowi.

- [x] **10.5 — ustawianie znacznika.** [`employees.service.ts`](apps/api/src/employees.service.ts):
  `sessionsValidFrom: new Date()` w `anonymize()` (obok istniejącego `passwordHash: null`,
  `feedToken: null`) **oraz** w `setPassword()`. Wczesny zwrot dla konta już zanonimizowanego
  (`login.startsWith('anon-')`) zostaje bez zmian — powtórna anonimizacja nie ma czego kończyć.
  Retencja korzysta z tej samej metody, więc obejmuje ją automatycznie.

### Testy

- [x] **10.6 — rozszerzenie istniejącej suity.** [`verify-sesja-uniewaznienie.mjs`](apps/api/verify-sesja-uniewaznienie.mjs)
  (prefiks `su`) — temat jest dokładnie ten sam, więc nie zakładamy nowego pliku i liczba suit
  zostaje 35. Dopisz sekcje po wzorze pozostałych, **tym samym tokenem wydanym przed zdarzeniem**:
  - `suanon`: token działa → administrator anonimizuje → ten sam token `401`
  - `suhaslo`: token działa → administrator ustawia nowe hasło → ten sam token `401`;
    logowanie nowym hasłem daje token, który działa (naprawa nie może zablokować konta na stałe)
  - kontrola pozytywna: anonimizacja jednej osoby nie rusza sesji innej
  - kontrola granicy: konto z `sessionsValidFrom` w przeszłości nie unieważnia świeżego logowania

### Dokumentacja

- [x] **10.7** [`README.md`](README.md), sekcja „Bezpieczeństwo (NFR-5)" — akapit opisujący dziś
  ten wyjątek („token wydany przed anonimizacją działa do wygaśnięcia") **jest już nieaktualny**
  i musi zniknąć; w jego miejsce jedno zdanie o tym, że anonimizacja i reset hasła kończą sesje.
  Odsyłacz do sekcji „Do decyzji" tego pliku traci sens — do usunięcia.

### Weryfikacja

```bash
pnpm exec prisma migrate dev          # lokalnie; na wdrożeniu migrate deploy przy starcie
pnpm run verify:offline               # build + typecheck + 86 testów silnika
pnpm -F @nieobecnosci/web lint
```
Potem API na porcie 3100 i `API=… pnpm run verify:suites` → oczekiwane `✅ Wszystkie 35 suit OK`.

**Kontrola odwrotna obowiązkowa** (jak przy Częściach 1–8): rozszerzona suita musi paść na kodzie
sprzed zmiany. Sposób: `git stash` na `auth.guard.ts` + `employees.service.ts`, przebudowa,
przebieg — asercje anonimizacji i resetu hasła mają wtedy pokazać `200` zamiast `401`. Suita,
która przechodzi w obie strony, nie testuje niczego.

Sprawdzenie w przeglądarce nie jest potrzebne: unieważniona sesja idzie tą samą ścieżką 401 co
token wygasły, a ta jest obsłużona i niezmieniona ([`api.ts:57`](apps/web/src/api.ts) czyści token
i wraca na ekran logowania).

### Świadomie poza zakresem

| Rzecz | Powód |
|---|---|
| Akcja „wyloguj mnie wszędzie" dla użytkownika | Nowa funkcja, nie naprawa. Mechanizm jest gotowy — to jedno wywołanie i endpoint, gdy będzie potrzebne. |
| Unieważnianie przy zmianie roli i uprawnień | Niepotrzebne: strażnik czyta jedno i drugie z bazy przy każdym żądaniu (Część 4), więc działa natychmiast bez kończenia sesji. |
| Ukrycie nieobecności osoby zanonimizowanej w kalendarzu i capacity | Osobne pytanie produktowe — anonimizacja celowo zostawia wpisy, bo planowanie zespołu potrzebuje historii obłożenia. Nie dotyczy sesji. |

---

## Do decyzji (rozstrzygnięte)

### ~~Anonimizacja nie zamyka trwającej sesji~~ → Część 10

Odkryte przy Części 4. Zapis rozumowania i odrzucone warianty zostawiam, bo tłumaczą, dlaczego
Część 10 wygląda tak, a nie inaczej:

| Wariant | Koszt | Rozstrzygnięcie |
|---|---|---|
| Kolumna znacznika sesji na `Employee` | Migracja schematu — odrzucona wprost przy wyborze podejścia do Części 4, bo tam dało się bez niej | **Wybrany.** Tutaj nie da się bez migracji, a to jedyny wariant, który mówi wprost, o co chodzi |
| Strażnik odrzuca konta z `passwordHash = null` | Wiąże autoryzację z lokalnym providerem haseł i zabiłby przyszłe SSO/OIDC, pod które [`auth-provider.ts`](apps/api/src/auth/auth-provider.ts) zostawia szew (FR-H5) | Odrzucony |
| `anonymize()` ustawia `endDate` na dziś | Bez migracji i działa od ręki, ale anonimizacja zaczyna twierdzić, że współpraca się zakończyła — nieprawda dla osoby nadal zatrudnionej. Osoba znika z „mojego zespołu", nie da się jej dopisać nieobecności, a pula za bieżący okres liczy się proporcjonalnie ([`proratePool`](packages/core/src/balance.ts); okresy wcześniejsze zostają bez zmian) | Odrzucony |
| Porównanie `iat` z `Employee.updatedAt` | Zero nowych kolumn, ale wylogowuje przy każdej zmianie wiersza — łącznie z regeneracją własnego `feedToken`, czyli akcją samoobsługową | Odrzucony |

---

## Dziennik postępu

> Po ukończeniu części dopisz wiersz: data, numer części, co faktycznie weszło, czy suity przeszły, co zostało odłożone.

| Data | Część | Status | Notatki |
|---|---|---|---|
| 2026-08-11 | — | — | plan utworzony, gałąź `naprawy-po-review`, kopia planu w repo jako `NAPRAWY-PO-REVIEW.md` |
| 2026-08-11 | 10 | ✅ ukończone | Kolumna `sessionsValidFrom` + migracja z backfillem z dziennika audytu; `anonymize()` i `setPassword()` ustawiają znacznik; strażnik odrzuca starsze tokeny. Suita `verify-sesja-uniewaznienie.mjs` rozszerzona do 18 asercji. **Kontrola odwrotna:** dwie nowe asercje padają na kodzie sprzed zmiany, reszta przechodzi w obie strony. **Backfill sprawdzony osobno:** 7 kont zanonimizowanych bez znacznika → po migracji zero. **Niespodzianka, która zmieniła projekt:** standardowe `iat` w JWT ma rozdzielczość SEKUNDOWĄ, więc reset hasła i logowanie zaraz po nim wypadają w tej samej sekundzie. Każde rozstrzygnięcie remisu było złe — zaokrąglenie w górę blokowało konto tuż po ustawieniu nowego hasła, w dół przepuszczało sesję sprzed anonimizacji; oba warianty najpierw zaimplementowałem i oba wywróciły suitę. Rozwiązanie: własny znacznik milisekundowy `iatMs` w tokenie, z zejściem do `iat * 1000` dla tokenów sprzed zmiany. |
| 2026-08-11 | 9 | ✅ ukończone | `AnalyticsService` wydzielony z kontrolera, `app.module` uporządkowany, README (macierz bezpieczeństwa, krok wdrożeniowy roli DB, luka anonimizacji) i HANDOFF (86 testów, 35 suit) zaktualizowane. **Weryfikacja końcowa — wszystkie cztery bramki CI lokalnie:** `verify:offline` 86/86 testów + build + typecheck ✅ · lint `jsx-a11y` ✅ · `pnpm audit --audit-level high` exit 0 (1 low, 9 moderate, zero high/critical) ✅ · `verify:suites` 35/35 ✅. |
| 2026-08-11 | 8 | ✅ ukończone | CSP + `X-Frame-Options` + `Referrer-Policy` + `Permissions-Policy` w `Caddyfile`; `scripts/db-appuser.sql` (rola bez UPDATE/DELETE na `AuditLog`, `MIGRATE_DATABASE_URL` w Dockerfile i `.env.prod.example`); `.dockerignore` rozszerzony; `backup.sh` pisze przez plik tymczasowy. **Sprawdzone naprawdę, nie założone:** CSP na produkcyjnym buildzie podanym z tymi nagłówkami — aplikacja renderuje się w całości, konsola czysta, wstrzyknięty skrypt inline i skrypt z obcej domeny zablokowane; rola DB na żywej bazie — INSERT/SELECT dziennika przechodzą, UPDATE/DELETE odbijają się o uprawnienia, a API na tej roli przechodzi 35/35 suit; `.dockerignore` na zbudowanym obrazie. **Niespodzianka:** wpis wykluczający katalog „Analiza dokumentów…" nie działał od początku — macOS zapisuje nazwy w NFD, więc wzorzec z polskimi znakami nie trafiał w nic; zastąpiony `Analiza*`. |
| 2026-08-11 | 7 | ✅ ukończone | Strażnik nieaktualnej odpowiedzi w podglądzie (`Wpis.tsx`), `updateAbsence` przyjmuje godziny, UI edycji wymiaru dnia i godzin w `Historia.tsx` i `Zespol.tsx`, lista wymiarów wyniesiona do `admin/ui` zamiast trzeciej kopii. **Sprawdzone w przeglądarce:** edycja 09:00–13:00 → 09:00–17:00 zmienia wymiar z 0,5 na 1 dzień; przed zmianą to samo żądanie wracało jako sukces, nie robiąc nic. Lint `jsx-a11y` czysty. |
| 2026-08-11 | 6 | ✅ ukończone | S1 (atrapa hasza), S2 (`verifyPassword` async), S3 (import per-wiersz w try/catch), S4 (partie po 8 w `/capacity/matrix`), S5 (`scopeWithMemberships`), S7 (`convertToL4` + deterministyczny wybór typu), audyt zmiany flag typu, dedup importu sprintów. **Pomiar S1:** przed — 5,5 ms dla nieistniejącego loginu wobec 30,2 ms dla istniejącego (pięciokrotna różnica, enumeracja trywialna); po — 0,2 ms. Przebieg: 35/35. |
| 2026-08-11 | 5 | ✅ ukończone | `sendOverdueReminders` liczy przez `BalanceService` (z wykluczeniem byłych i zanonimizowanych), szeregowanie zapisów per pracownik w `AbsencesService`. Dwie nowe suity. **Kontrola odwrotna:** przypomnienia wysyłały 0 przy domyślnym `carriedOver = null`; wyścig zapisywał 4 dni z puli 3-dniowej i schodził saldem do −1. **Wada mojego testu, nie kodu:** suita przypomnień dziedziczyła próg 400 dni po `verify-dlug-konfiguracja` (runner czyści bazę raz) — ustawia teraz warunki wprost i sprawdza je na własnych osobach. |
| 2026-08-11 | 4 | ✅ ukończone | Token niesie tylko `sub`; strażnik czyta rolę, uprawnienia i `endDate` z bazy przy każdym żądaniu; `endDate` blokuje też logowanie. Nowa suita `verify-sesja-uniewaznienie.mjs` (11 asercji, w tym kontrola pozytywna „niezwiązana zmiana nie wylogowuje"). **Kontrola odwrotna:** 5 asercji pada na starym kodzie — w tym usunięte konto, którego token dalej działał. **Kolizja z istniejącą suitą:** `verify-faza2-proration.mjs` logował się jako osoba po `endDate`, czyli polegał na naprawianym defekcie; wpisy przeniesione na administratora (badana reguła FR-B9 dotyczy osoby, której wpis dotyczy), a nieudane logowanie dopisane tam jako asercja. Przebieg: `✅ Wszystkie 33 suit OK` + `verify:offline` OK. **Luka pozostała, wymaga decyzji:** anonimizacja nie zamyka trwającej sesji — patrz sekcja „Do decyzji". |
| 2026-08-11 | 3 | ✅ ukończone | `HIDDEN_EMPLOYEE_FIELDS` (hash hasła + `feedToken`) podstawione w 6 miejscach zwracających pracownika, w tym `setPassword`, które wcześniej nie miało `omit` w ogóle. `anonymize()` czyści `feedToken`. Nowa suita `verify-rodo-feedtoken.mjs` (15 asercji). **Kontrola odwrotna:** 7 asercji pada na starym kodzie — token wyciekał do wszystkich czterech uprzywilejowanych ról, a kanał przeżywał anonimizację. Przebieg: `✅ Wszystkie 32 suit OK`. |
| 2026-08-11 | 1 + 2 | ✅ ukończone | Zacisk `0..1` w `dayFraction` (`NaN` → `0`), `@Matches(HH:MM)` na godzinach we wszystkich trzech DTO, strażnik `HOURS` w `validate()`, godziny zapisywane i walidowane w `update()` z regułą „godziny wyłącznie dla `HOURS`". Testy: +4 przypadki vitest (86 → 90), nowa suita `verify-godziny-walidacja.mjs` (17 asercji). **Kontrola odwrotna wykonana:** na kodzie sprzed poprawki suita pada na wszystkich 7 asercjach odrzucenia i wywraca się na kolizji 409 — czyli śmieciowe wpisy faktycznie się zapisywały. Pełny przebieg: `✅ Wszystkie 31 suit OK`, brak regresji. Części 1 i 2 połączone w jeden przebieg, bo dotykają tej samej funkcji `validate()`. |
