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

STAN: MVP + Faza 2 (16 pozycji) + część Fazy 3 — zbudowane i zweryfikowane.
Ostatni pełny przebieg: silnik 66/66 testów, 27 suit integracyjnych (218 asercji), build+typecheck czysto.
Działa m.in.: wpis/edycja/undo (≤3 kliknięcia), kalendarz Tribe (jednolity, bez typów), RBAC 6 ról,
ochrona L4 (art. 9 RODO — znacznik tylko dla VIEW_L4/admin, każdy odczyt audytowany), capacity per sprint
+ alert kolizji kluczowych ról, heatmapa pokrycia, operacje masowe, raporty z drążeniem hierarchii,
eksport .xlsx i wersjonowany eksport płac, kanały iCal, powiadomienia e-mail i in-app, scheduler
(przypomnienia + retencja), rejestr RODO, historia zmian, analityka adopcji, health/monitoring, backup,
wdrożenie on-prem (compose prod + Caddy/TLS) i CI.

URUCHOMIENIE I WERYFIKACJA (szczegóły w README.md):
- pnpm install && pnpm db:up && pnpm db:migrate
- pnpm -F @nieobecnosci/api build && PORT=3100 node apps/api/dist/main.js
- pnpm -F @nieobecnosci/web dev            → http://localhost:5188
- pnpm run verify:offline                  → build + typecheck + 27 testów silnika
- API=http://localhost:3100/api pnpm run verify:suites   → 27 suit (UWAGA: czyszczą bazę)
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
   brakuje implementacji OIDC. Dalej: TETA, JIRA/QBR.
2. NFR-9 — interfejs EN dla współpracowników OUT (priorytet „Could").
3. Przedprodukcyjne: pełny audyt WCAG (axe), test obciążeniowy ~300 użytkowników (NFR-1).
4. Układ kolumn plików importu .xlsx (FR-G5/D4) — do ustalenia z zamawiającym; obecnie mapowanie
   kolumn jest konfigurowalne.
5. Wydajność heatmapy: pobiera capacity per squad×sprint (N×M zapytań) — przy większej skali
   dołożyć zbiorczy endpoint /capacity/matrix.

Kontekst źródłowy: wymagania i backlog to pliki .docx/.xlsx w katalogu głównym; decyzje projektowe
i model danych opisuje README.md.

Zacznij od przeczytania README.md i packages/core, potem zaproponuj kolejność prac i działaj.
```

---

## Notatki dla prowadzącego projekt

- Repozytorium git zostało założone lokalnie (gałąź `main`), **bez zdalnego remote** — przy przekazaniu
  projektu dodaj `git remote add origin …` i wypchnij, żeby CI (`.github/workflows/ci.yml`) zaczęło działać.
- Suity `verify-*.mjs` czyszczą bazę. Po ich uruchomieniu odtwórz demo: `node apps/api/demo-seed.mjs`.
- Rozstrzygnięcia biznesowe zapadłe w trakcie prac: urlop **nigdy nie przepada** (niewykorzystane dni
  przechodzą jako zaległy, bez terminu wygaśnięcia); przypomnienia mają charakter informacyjny.
- Kwestie nadal otwarte u zamawiającego: granice roku budżetowego B2B/OUT, docelowe SLA, okres retencji
  danych, potrzeba interfejsu EN.
