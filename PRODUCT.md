# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Ok. 300 użytkowników w jednym departamencie o strukturze zwinnej, 6 zespołów. Interfejs po polsku.

- **Pracownik UoP** — wpisuje własne nieobecności, sprawdza balans urlopu w roku kalendarzowym. Użytkownik główny: to jego wpisy zasilają wszystkie pozostałe widoki.
- **Współpracownik B2B / OUT** — to samo, ale rozliczany w roku budżetowym; jego wpis generuje powiadomienie do lidera (informacyjne, bez akceptacji).
- **Lider / Chapter Lider / przełożony** — ogląda kalendarz zespołu, koryguje wpisy członków swojego Tribe na etapie weryfikacji, generuje raporty wykorzystania w Tribe.
- **Product Owner / Agile PM** — planuje capacity squadu w ujęciu sprintowym; potrzebuje wiedzieć, ile osobodni realnie zostaje w sprincie.
- **Dyrektor departamentu** — raporty zbiorcze wykorzystania i liczby dni nieobecności w pionie/departamencie, w tym „kto zalega".
- **PMO** — dane w formacie gotowym do eksportu (płace), analityka adopcji.
- **Osoba z uprawnieniem rozszerzonym** — pracownik wskazany przez menedżera lub administratora; dodaje nieobecności (w tym L4) w imieniu innych, generuje raporty.
- **Administrator aplikacji** — typy nieobecności, pula urlopu, święta, struktura, sprinty, role i uprawnienia, eksporty, retencja.

**Sytuacja użycia:** okres aktualizacji nieobecności pokrywa się z planowaniem sprintu, więc dostęp jest skokowy — wielu ludzi chce pisać jednocześnie. To była bezpośrednia przyczyna „kolejek" do pliku Excel i jest głównym scenariuszem obciążenia.

## Product Purpose

Rejestracja i monitorowanie nieobecności pracowników w skali całego departamentu — w miejsce rozproszonych, awaryjnych plików Excel prowadzonych osobno w każdym zespole.

Cztery cele z dokumentu wymagań: wyeliminowanie blokad pliku (wielodostęp w czasie rzeczywistym), jedno źródło prawdy z automatyczną agregacją w górę hierarchii, samoobsługa pracownika z czytelnym licznikiem wykorzystania, wsparcie planowania capacity squadów per sprint.

**Miary sukcesu (KPI):**

- 0 incydentów blokady pliku — czyli klasa problemu z Excela znika, a nie zostaje przeniesiona.
- Satysfakcja użytkowników > 80%, mierzona wbudowaną analityką adopcji (NFR-8).
- Maksymalnie **3 kliknięcia** od zalogowania do zapisania wpisu i od zalogowania do podglądu raportu (NFR-6). To twarde kryterium akceptacji, nie aspiracja.
- Licznik balansu odświeża się < 1 s po dodaniu, edycji lub usunięciu wpisu (FR-B2); pulpit i kalendarz ładują się < 2 s przy 300 jednoczesnych użytkownikach (NFR-1).

## Positioning

Trzy rzeczy, których sąsiedni produkt urlopowy nie mógłby uczciwie skopiować:

1. **Dwa równoległe okresy rozliczeniowe jako reguła pierwszej klasy.** UoP rozliczany w roku kalendarzowym, B2B i OUT w roku budżetowym (przesunięcie o 1 miesiąc wstecz). To jedyny wprost zapisany **warunek akceptacji** całego projektu (FR-B1 / D5), nie opcja konfiguracyjna.
2. **Jednolita prezentacja nieobecności jako wymaganie prawne.** Typ wpływa wyłącznie na algorytm; żaden widok, kanał iCal, eksport ani powiadomienie nie ujawnia, że wpis to L4. Znacznik L4 to dana o zdrowiu (art. 9 RODO) chroniona na poziomie serializacji per rola, a każdy uprawniony odczyt trafia do audytu. Standardowe „kolorowanie typów urlopu" jest tu wykluczone (D1/D2, ankieta oceniła je na 1/5).
3. **Planowanie zamiast akceptacji.** Brak workflow zatwierdzania wniosków (D3) — wpis obowiązuje od zapisania. Produkt służy widoczności i planowaniu capacity, nie procesowi kadrowemu; formalny wniosek urlopowy dla UoP pozostaje poza aplikacją (TETA/HR).

Do tego: wdrożenie **on-premise**, bez zależności od zewnętrznych usług — świadoma decyzja instytucji finansowej, nie ograniczenie techniczne.

## Operating Context

- **Hierarchia organizacyjna:** pion › departament › Tribe › chapter/squad › osoba. Jedna osoba może należeć do kilku jednostek jednocześnie, a jej dane agregują się we wszystkich (FR-G4). Widoczność bazowa to Tribe — wszyscy w Tribe widzą wszystkich, filtrowanie schodzi do squadu (FR-H1).
- **Sprinty:** cykl planistyczny, zwykle 2 tygodnie, wg harmonogramu QBR. W MVP wgrywane ręcznie z .xlsx z konfigurowalnym mapowaniem kolumn (docelowo JIRA).
- **Jednostka czasu:** system 8-godzinny. Wpisy całodniowe, półdniowe (AM/PM) i godzinowe, przeliczane na ułamek dnia w balansie i w capacity.
- **Kalendarze świąt:** wiele kalendarzy, przypisywanych per pracownik/lokalizacja (dla B2B/OUT z innych lokalizacji), plus dni dodatkowe z ustaleń organizacji, np. odbiory za święta wypadające w sobotę.
- **Kanały wyjściowe:** e-mail (jedyny kanał powiadomień w MVP), subskrypcja iCal kalendarza zespołu, eksporty .xlsx dla raportów, wersjonowany schemat eksportu płacowego dla PMO.
- **Środowisko pracy:** stacje robocze w godzinach pracy organizacji, sieć wewnętrzna, wdrożenie on-prem (Docker Compose + Caddy/TLS na jednej maszynie).

## Capabilities and Constraints

**Zbudowane i zweryfikowane:** całe MVP (wszystkie „Must"), Faza 2 w 16 pozycjach, część Fazy 3 — heatmapa pokrycia (C4), operacje masowe (A10), kanały iCal (F4), powiadomienia in-app, scheduler przypomnień i retencji, ekran korekty wpisów przez lidera (A5), import .xlsx z konfigurowalnym mapowaniem kolumn (G5/D4), rejestr czynności przetwarzania, analityka adopcji, health/monitoring, backup, CI.

**Reguły biznesowe, które muszą zostać zachowane:**

- Urlop **nigdy nie przepada** — niewykorzystane dni przechodzą na kolejny okres jako zaległy, bez terminu wygaśnięcia. Rozstrzygnięcie zapadłe w trakcie prac; przypomnienia mają charakter wyłącznie informacyjny.
- L4 dla UoP obniża capacity zespołu, ale **nie** obniża puli urlopu (FR-B5).
- Pulę definiuje administrator globalnie, z korektą indywidualną — brak integracji z TETA (D4).
- Backend jest źródłem prawdy dla uprawnień: guard plus serializacja zależna od roli. UI odzwierciedla zakres, ale go nie egzekwuje.
- Weekendy i dni z tabeli świąt nie są naliczane; liczbę dni roboczych wylicza serwer kalendarzem właściwym dla danej osoby.

**Świadomie poza zakresem:** integracja z AD (zasilanie importem .xlsx), SSO przez AD (jest przygotowany szew `AuthProvider`, brak implementacji OIDC), TETA, JIRA/QBR jako źródło sprintów, dodatkowe kanały powiadomień (push/SMS), załączniki do wpisów, migracja danych historycznych, symulacja „what-if".

**Decyzja o zasięgu urządzeń:** aplikacja jest **desktop-only**. NFR-6 w wersji 2.0 dokumentu wymaga interfejsu responsywnego dla desktopu i urządzeń mobilnych — ten punkt został zdescope'owany decyzją prowadzącego projekt (2026-08-07). Wymaganie „maks. 3 kliknięcia", pochodzące z tego samego NFR-6, **pozostaje wiążące**. Przyszłe prace projektowe mogą zakładać stację roboczą; nie zwalnia to z obsługi klawiatury i czytnika ekranu (NFR-7).

**Otwarte, nierozstrzygnięte u zamawiającego** — przyszłe prace mają je traktować jako niewiadome, nie zgadywać:

- dokładne granice roku budżetowego dla B2B/OUT,
- docelowy poziom SLA (NFR-2 podaje 99,5% jako przykład „do potwierdzenia"),
- okres retencji danych nieobecności (FR-J2; implementacja przyjmuje domyślnie 24 miesiące),
- ostateczny układ kolumn plików importu pracowników i sprintów (FR-G5, D4),
- czy potrzebny jest interfejs angielski dla współpracowników OUT (NFR-9, priorytet „Could"),
- dokładna reguła przełomu okresu rozliczeniowego (FR-B7).

**Słownik:** UoP, B2B, OUT, rok kalendarzowy, rok budżetowy, capacity, Tribe/Squad/Chapter, L4, sprint. Definicje w dokumencie wymagań, sekcja 2 — terminologia w UI ma się z nimi zgadzać.

## Brand Commitments

- **Nazwa produktu:** „Nieobecności". Znak: glif kalendarza w zaokrąglonym kaflu w kolorze marki + wordmark.
- **Zamawiający:** Credit Agricole. Paleta produktu wywodzi się z **oficjalnej palety Pantone organizacji** (P341 `#007A53`, P342 `#006A4E` jako zieleń podstawowa, plus swatche uzupełniające) i jest wiążąca — nie jest wyborem estetycznym do renegocjacji. Źródło: `Makiety - aplikacja nieobecnosci (Credit Agricole).html`.
- **Głos:** polski, profesjonalny, spokojny, prosty. Produkt jest narzędziem wewnętrznym regulowanej instytucji finansowej — treść ma być precyzyjna i budząca zaufanie, nigdy żartobliwa.
- **Zwrot do użytkownika:** druga osoba liczby pojedynczej, ciepło, ale służbowo („Twój urlop", „Zaplanuj nieobecność"). Komunikaty systemowe bezosobowo („Wpis obowiązuje od zapisania").
- **Konwencje zapisu:** sentence case w nagłówkach i przyciskach; wersaliki wyłącznie w małych etykietach tabel; polskie cudzysłowy „…"; formaty dat i liczb polskie; zakresy z półpauzą. Emoji praktycznie nie występują — jedyny sankcjonowany to machająca dłoń w powitaniu na pulpicie.

## Evidence on Hand

Materiały realne, do wykorzystania bez wymyślania:

- `Wymagania funkcjonalne - aplikacja do monitorowania nieobecnosci.docx` — wersja 2.0 z 22.06.2026: FR-A…FR-J, NFR-1…9, decyzje D1–D7, macierz uprawnień, model danych, fazowanie MoSCoW.
- `Backlog - aplikacja nieobecnosci.docx` / `.xlsx` — 11 epików, 67 historii.
- `Aplikacja do rejestrowania nadgodzin.docx` — dokument biznesowy będący źródłem wymagań.
- `Analiza dokumentów i ekranów/` — udokumentowany system projektowy z prototypu (tokeny, komponenty, wytyczne, odtworzone ekrany hi-fi, `readme.md`).
- `Makiety - aplikacja nieobecnosci (Credit Agricole).html`, `Aplikacja Nieobecnosci (offline).html` — prototypy referencyjne.
- `README.md`, `HANDOFF.md` — stan wdrożenia, RBAC, uruchomienie, decyzje.
- `apps/api/demo-seed.mjs` — realistyczny scenariusz demonstracyjny: Pion Operacji › Departament IT › Tribe Alfa › 5 squadów, 21 osób, 7 sprintów, nieobecności generowane względem dnia uruchomienia.
- Dowód poprawności: 27 testów silnika wyliczeń, 23 suity integracyjne (147 asercji), CI na PostgreSQL.

Czego **nie ma** i czego nie wolno wymyślać:

- **Brak danych z produkcji** — aplikacja nie była jeszcze wdrożona u użytkowników. Wszelkie liczby użycia, adopcji czy satysfakcji byłyby zmyślone.
- **Brak opinii i cytatów użytkowników.**
- Oceny priorytetów w sekcji 8 dokumentu pochodzą z **jednej odpowiedzi ankietowej z 09.06.2026** — to sygnał, nie badanie. Nie prezentować ich jako wyniku badań ilościowych.
- **Brak testu obciążeniowego** dla 300 jednoczesnych użytkowników (NFR-1 niezweryfikowany).
- **Brak pełnego audytu WCAG** narzędziem automatycznym (axe).
- Liczby „~300 użytkowników / 6 zespołów" pochodzą z D6 dokumentu wymagań i są jedynymi zweryfikowanymi liczbami o skali.

## Product Principles

1. **Jednolitość nieobecności to zgodność prawna, nie styl.** Kolor, ikona, etykieta ani kolejność nigdy nie ujawniają typu wpisu. Każda propozycja „rozróżnijmy typy dla czytelności" jest naruszeniem D1/D2/FR-J1, nie ulepszeniem.
2. **Uprawnienia egzekwuje serwer, interfejs je odzwierciedla.** Ukrycie czegoś w UI nie jest zabezpieczeniem; menu i widoki mają odpowiadać zakresowi roli, żeby użytkownik nie trafiał na ściany 403.
3. **Licznik balansu jest głównym produktem dla pracownika.** Ankieta dała mu 5/5 — najwyżej ze wszystkich funkcji. Ma być natychmiastowy (< 1 s), zawsze widoczny i zrozumiały bez wyjaśnień.
4. **Trzy kliknięcia do wpisu i do raportu.** Każda nowa warstwa nawigacji, potwierdzenia lub kroku formularza musi się zmieścić w tym budżecie albo go zwolnić gdzie indziej.
5. **Dwa okresy rozliczeniowe są warunkiem akceptacji.** Wszystko, co dotyka dat, puli i balansu, musi jawnie rozstrzygać, czy patrzy na rok kalendarzowy, czy budżetowy. Domyślne założenie „rok kalendarzowy" jest błędem dla jednej trzeciej form zatrudnienia.

## Accessibility & Inclusion

- **WCAG 2.1 na poziomie AA (NFR-7)** — wymaganie kontraktowe, nie aspiracja. Obejmuje kontrast, obsługę z klawiatury i czytnik ekranu.
- Interakcje mają się opierać na natywnych elementach (`<button>`, `<a>`, `<input type="date/time">`, `<select>`), bo to najtańsza droga do zgodności z klawiaturą i AT.
- `<html lang="pl">`; kontrolki bez widocznej etykiety mają dostępną nazwę.
- Aplikacja jest desktop-only (patrz Capabilities and Constraints), więc obsługa dotyku nie jest wymagana — **obsługa klawiatury i czytnika ekranu pozostaje wymagana w pełni**.
- Lokalizacja: interfejs polski. Angielski dla współpracowników OUT jest opcją nierozstrzygniętą (NFR-9, „Could") — teksty warto pisać tak, by późniejsze wydzielenie ich do tłumaczenia nie wymagało przebudowy.
