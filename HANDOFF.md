# HANDOFF — prompt do nowego wątku

Skopiuj poniższy blok jako pierwszą wiadomość w nowej sesji.

---

```text
Pracuję nad aplikacją „Nieobecności" w /Volumes/Projekty/nieobecnosci — wewnętrzny system rejestracji
i monitorowania nieobecności (~300 użytkowników; struktura pion›departament›Tribe›squad), zastępujący
pliki Excel. Chcę kontynuować pracę nad tą aplikacją.

STACK (TypeScript end-to-end, on-premise, UI po polsku):
- packages/core — czysty silnik wyliczeń (Vitest, bez IO): okresy rozliczeniowe (UoP = rok kalendarzowy,
  B2B/OUT = rok budżetowy −1 mc), dni robocze ze świętami, balans, capacity, proration, rollover
  (niewykorzystane dni przechodzą jako urlop zaległy — nie przepadają), generowanie iCal.
- apps/api — NestJS + Prisma + PostgreSQL (MVCC = współbieżny zapis bez blokad pliku).
- apps/web — React + Vite + design system przeniesiony z prototypu („Analiza dokumentów i ekranów/").

STAN: MVP + Faza 2 (16 pozycji) + część Fazy 3 — zbudowane i zweryfikowane. Backlog liczy 74 historyjki;
stan każdej odnotowuje kolumna „Stan wdrożenia" w Backlog - aplikacja nieobecnosci.xlsx (wersja śledzona;
.docx to pierwotne wydanie bez tej kolumny). Wg przeglądu kodu z 10.08.2026 backlog NIE zawyża stanu:
realnie otwarta jest jedna historyjka (US-N9, interfejs EN) i jedna częściowa (US-N2, progi/alerty).
Ostatni pełny przebieg (08.09.2026, po drugiej rundzie uwag zleceniodawcy): silnik 93/93 testów, 42 suity integracyjne, build+typecheck+lint
czysto, audyt zależności bez podatności „high", test obciążeniowy 300 użytkowników w budżecie NFR-1,
audyt axe bez naruszeń, test odtworzenia backupu OK.
Działa m.in.: wpis/edycja/undo (≤3 kliknięcia), kalendarz Tribe (jednolity, bez typów), RBAC 6 ról,
ochrona L4 (art. 9 RODO — znacznik tylko dla VIEW_L4/admin; audytowany jest odczyt przez /absences
ORAZ przez eksport płacowy), capacity per sprint + alert kolizji kluczowych ról, heatmapa pokrycia,
operacje masowe, raporty z drążeniem hierarchii, eksport .xlsx i wersjonowany eksport płac, kanały iCal,
powiadomienia e-mail i in-app, scheduler (przypomnienia + retencja), rejestr RODO, historia zmian,
analityka adopcji, health/monitoring, backup z testem odtworzenia, wdrożenie on-prem (compose prod
+ Caddy/TLS) i CI z bramkami jakości (lint dostępności, audyt zależności).

URUCHOMIENIE I WERYFIKACJA (szczegóły w README.md):
- pnpm install && pnpm db:up && pnpm db:migrate
- pnpm -F @nieobecnosci/api build && PORT=3100 node apps/api/dist/main.js
- pnpm -F @nieobecnosci/web dev            → http://localhost:5188
- pnpm run verify:offline                  → build + typecheck (3 pakiety) + 86 testów silnika
- API=http://localhost:3100/api pnpm run verify:suites   → 35 suit (UWAGA: czyszczą bazę)
- pnpm -F @nieobecnosci/web lint            → bramka dostępności (jsx-a11y), ta sama co w CI
- pnpm audit --prod --audit-level high      → bramka podatności, ta sama co w CI
- scripts/restore-test.sh KATALOG_BACKUPÓW  → test odtworzenia backupu (kwartalnie, NFR-4)
- node apps/api/demo-seed.mjs              → dane demo (daty względne wobec dnia uruchomienia)
  Loginy: admin/admin; dyrektor, pmo, lider, po, pracownik, anna, bartek, celina, ext = demo123
  (pracownik = UoP, ext = OUT — para do porównania form zatrudnienia)

KONWENCJE:
- Tryb ponytail: najprostsze działające rozwiązanie; stdlib/native przed zależnościami; najkrótszy
  działający diff — ale dopiero po zrozumieniu problemu. Świadome uproszczenia oznaczaj `ponytail:`.
- Każda nietrywialna logika zostawia JEDEN uruchamialny test: nowa suita apps/api/verify-*.mjs
  (dopisz ją do listy w apps/api/run-verify.mjs) albo test w packages/core.
- Nie twierdź, że coś działa, dopóki tego nie uruchomisz. Zmiany widoczne w przeglądarce weryfikuj
  w preview (port 5188) i pokaż zrzut ekranu — nie proś użytkownika o ręczne sprawdzenie.
- L4 nigdy nie jest wyróżniane: ani wizualnie, ani w kanałach iCal/feedzie, ani w eksportach dla
  nieuprawnionych. Backend jest źródłem prawdy dla uprawnień (guard + serializacja per rola).
- UI po polsku, zgodnie z design systemem (Archivo + IBM Plex Mono, zielony brand, ikony Lucide).

DO ZROBIENIA (priorytety do ustalenia z użytkownikiem):
1. Integracja AD/SSO — w apps/api/src/auth/auth-provider.ts jest przygotowany szew (AuthProvider);
   brakuje implementacji OIDC. Uwaga: sygnatura authenticate(login, password) nie ma miejsca na
   code/redirect/state, więc podmiana na OIDC wymaga zmiany interfejsu. Dalej: TETA, JIRA/QBR.
2. NFR-9 — interfejs EN dla współpracowników OUT (priorytet „Could", potrzeba nierozstrzygnięta).
   Brak jakiejkolwiek warstwy i18n: ~570 linii polskiego tekstu w 25 z 36 plików apps/web,
   komunikaty błędów API też są polskimi literałami.
3. Przedprodukcyjne: powtórzyć loadtest na docelowym sprzęcie; audyt WCAG ekspercki (automat axe
   już przeszedł bez naruszeń, ale pokrywa tylko część kryteriów).
4. Układ kolumn plików importu .xlsx (FR-G5/D4) — do ustalenia z zamawiającym; obecnie mapowanie
   kolumn jest konfigurowalne.
5. Znane braki jakościowe spoza backlogu (nie są długiem wobec zamawiającego, są ryzykiem):
   zero testów frontendu (apps/web nie ma skryptu test — chroni go tylko tsc i lint jsx-a11y);
   audyt axe uruchamiany ręcznie z konsoli przeglądarki wg README, bez powtarzalnego artefaktu;
   kopia off-site backupu wciąż zakomentowana w scripts/nieobecnosci-backup.service; obraz API
   jednoetapowy (źródła i devDeps w produkcji).

Kontekst źródłowy: wymagania i backlog to pliki .docx/.xlsx w katalogu głównym; decyzje projektowe
i model danych opisuje README.md.

Zacznij od przeczytania README.md i packages/core, potem zaproponuj kolejność prac i działaj.
```

---

## Notatki dla prowadzącego projekt

- Repozytorium ma remote `origin` (`Bartes74/rejestr_nieobecnosci`) i **działające CI** —
  `.github/workflows/ci.yml` uruchamia się przy każdym pushu i PR. Praca idzie przez gałęzie i PR-y,
  gałąź po scaleniu jest usuwana. Nie commituj bezpośrednio na `main`.
- CI zawiera dwie bramki, które padają, gdy coś się zepsuje: `pnpm -F @nieobecnosci/web lint`
  (reguły `jsx-a11y`) i `pnpm audit --prod --audit-level high`. Podatności transitive domykaj przez
  `pnpm.overrides` w `package.json`, nie przez obniżanie progu bramki.
- W konfiguracji lintu `jsx-a11y/no-noninteractive-tabindex` ma dopisaną rolę `region`. To celowe:
  przewijane siatki kalendarza i heatmapy muszą mieć `tabIndex={0}` (axe, WCAG 2.1.1
  `scrollable-region-focusable`), a domyślna reguła tego zabrania. Nie „naprawiaj" tego przez
  usunięcie `tabIndex` — regresja wyszłaby dopiero w audycie dostępności.
- Suity `verify-*.mjs` czyszczą bazę. Po ich uruchomieniu odtwórz demo: `node apps/api/demo-seed.mjs`.
- Rozstrzygnięcia biznesowe zapadłe w trakcie prac: urlop **nigdy nie przepada** (niewykorzystane dni
  przechodzą jako zaległy, bez terminu wygaśnięcia, automatycznie na przełomie okresu — FR-B7);
  przypomnienia mają charakter informacyjny. Reguła nie jest konfigurowalna i nie ma być.
- `WNIOSEK-ZAWEZENIE-NFR.md` — **zatwierdzony przez Credit Agricole 10.08.2026**. NFR-6 w wariancie
  pośrednim (pulpit i wpis na telefonie, pozostałe dziewięć ekranów desktop), NFR-7 bez kryterium
  1.4.10 Reflow. To uzgodniony zakres, nie propozycja — nie otwierać go ponownie bez decyzji klienta.
- Kwestie nadal otwarte u zamawiającego: granice roku budżetowego B2B/OUT, docelowe SLA, okres retencji
  danych, potrzeba interfejsu EN.
- **Przegląd kodu 10.08.2026 (PR #9).** Wniosek: backlog nie zawyżał stanu, ale dokumentacja rozjeżdżała
  się z kodem w obie strony. Znalezione i domknięte: eksport płacowy wydawał dni kategorii szczególnej
  bez wpisu do audytu (nieprawdziwa deklaracja z art. 9 RODO), `GET /pools/default` był bez `@Roles`,
  `GET /absences` bez `employeeId` zwracał adminowi wszystkie nieobecności wszystkich osób. README
  i HANDOFF opisywały natomiast dług, który już spłacono (heatmapa i `/capacity/matrix`).
  Wniosek na przyszłość: stan czytaj z kodu i z kolumny „Stan wdrożenia", nie z prozy w README.
