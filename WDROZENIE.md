# Wdrożenie aplikacji „Nieobecności" — poradnik krok po kroku

Poradnik dla osoby, która **nie zna tej aplikacji** i ma ją uruchomić na docelowym serwerze.
Zakłada wyłącznie umiejętność zalogowania się na serwer i wklejania poleceń. Każdy krok kończy się
sprawdzeniem, po którym wiadomo, czy iść dalej.

Obejmuje **dwie sytuacje**, wspólne aż do rozdziału 7, w którym drogi się rozchodzą:

- **instalację od zera** — nowy serwer, pusta baza, dane wprowadzasz sam
  ([7.1](#71-wariant-a--nowa-instalacja-seed));
- **przeniesienie działającej aplikacji** w nowe miejsce, razem z jej danymi
  ([7.3](#73-wariant-b--przeniesienie-danych-z-istniejącej-instalacji)).

Czas: **około 1–2 godzin**, z czego większość to czekanie na budowanie obrazów. Przeniesienie
danych dokłada kilkanaście minut.

> **Zasada nadrzędna.** Jeśli krok kończy się inaczej, niż opisano — zatrzymaj się i zajrzyj do
> rozdziału [11. Gdy coś nie działa](#11-gdy-coś-nie-działa). Przejście dalej „na siłę" zwykle
> zamienia jeden problem w trzy.

---

## Spis treści

1. [Co właściwie postawimy](#1-co-właściwie-postawimy)
2. [Czego potrzebujesz, zanim zaczniesz](#2-czego-potrzebujesz-zanim-zaczniesz)
3. [Przygotowanie serwera](#3-przygotowanie-serwera)
4. [Wgranie aplikacji na serwer](#4-wgranie-aplikacji-na-serwer)
5. [Plik konfiguracyjny `.env.prod`](#5-plik-konfiguracyjny-envprod)
6. [Pierwsze uruchomienie](#6-pierwsze-uruchomienie)
7. [Napełnienie bazy w nowym miejscu](#7-napełnienie-bazy-w-nowym-miejscu)
   — [seed](#71-wariant-a--nowa-instalacja-seed) ·
   [przeniesienie danych](#73-wariant-b--przeniesienie-danych-z-istniejącej-instalacji) ·
   [dane demo](#74-instancja-testowa--dane-demonstracyjne)
8. [Pierwsze logowanie](#8-pierwsze-logowanie)
9. [Kopie zapasowe](#9-kopie-zapasowe)
10. [Codzienna obsługa](#10-codzienna-obsługa)
11. [Gdy coś nie działa](#11-gdy-coś-nie-działa)
12. [Odtworzenie po awarii](#12-odtworzenie-po-awarii)
13. [Czego nie wolno robić](#13-czego-nie-wolno-robić)
14. [Lista kontrolna wdrożenia](#14-lista-kontrolna-wdrożenia)

---

## 1. Co właściwie postawimy

Na **jednym serwerze** stawiamy trzy współpracujące usługi. Nie musisz ich instalować osobno —
Docker zrobi to za Ciebie na podstawie plików, które są już w repozytorium.

```
                    Internet / sieć firmowa
                              │
                     port 443 (HTTPS)
                              │
                    ┌─────────▼─────────┐
                    │       web         │   Caddy: szyfrowanie (TLS),
                    │  (serwer WWW)     │   strona aplikacji, przekazywanie /api
                    └─────────┬─────────┘
                              │  (sieć wewnętrzna Dockera)
                    ┌─────────▼─────────┐
                    │        api        │   NestJS: cała logika,
                    │  (serwer aplik.)  │   uprawnienia, wyliczenia
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │        db         │   PostgreSQL: dane
                    │  (baza danych)    │   (w wolumenie `dbdata`)
                    └───────────────────┘
```

**Co to znaczy w praktyce:**

- Użytkownicy wchodzą przeglądarką pod jeden adres (np. `https://absencje.firma.example`).
- Na zewnątrz wystawione są tylko porty **80** i **443**. Baza i serwer aplikacji **nie są**
  dostępne z sieci — rozmawiają wewnątrz Dockera.
- Dane leżą w wolumenie Dockera o nazwie `dbdata`. Usunięcie kontenerów **nie** kasuje danych;
  kasuje je dopiero jawne usunięcie wolumenu (patrz rozdział 13).

---

## 2. Czego potrzebujesz, zanim zaczniesz

Zbierz to **przed** rozpoczęciem — brak którejkolwiek pozycji zatrzyma Cię w połowie.

| Co | Szczegóły | Skąd wziąć |
| --- | --- | --- |
| Serwer | Linux (Ubuntu 22.04+ / Debian 12+), min. **2 rdzenie, 4 GB RAM, 20 GB dysku** | dział infrastruktury |
| Dostęp | konto z prawem `sudo` (SSH) | dział infrastruktury |
| Wolne porty | **80** i **443** na tym serwerze | sprawdzimy w kroku 3 |
| Nazwa adresu | np. `absencje.firma.example`, wskazująca na IP serwera | dział sieci / DNS |
| Serwer poczty | adres i port SMTP (do przypomnień o urlopie) | dział IT |
| Kod aplikacji | to repozytorium | dostęp do repozytorium Git |
| **Tylko przy przenoszeniu:** dostęp do starego serwera | konto z prawem uruchomienia `docker compose` i skopiowania pliku (`scp`) | osoba prowadząca dotychczasową instalację |

**Aplikacja przetwarza dane osobowe pracowników, w tym informację o zwolnieniach lekarskich
(kategoria szczególna, art. 9 RODO).** Przed produkcyjnym startem upewnij się, że wdrożenie
jest uzgodnione z osobą odpowiedzialną za ochronę danych w organizacji.

### Jaki adres wybrać — to ma znaczenie

| Wybór | Co się stanie | Kiedy stosować |
| --- | --- | --- |
| Adres publiczny w DNS (np. `absencje.firma.example`) | Caddy **sam** pobierze darmowy certyfikat (Let's Encrypt). Kłódka w przeglądarce od razu. Wymaga, by serwer był dostępny z internetu na porcie 80 | gdy aplikacja ma być dostępna z internetu |
| Adres wewnętrzny (np. `absencje.firma.local`) | Caddy wystawi certyfikat własny. Przeglądarki pokażą **ostrzeżenie o niezaufanym certyfikacie**, dopóki dział IT nie rozdystrybuuje certyfikatu Caddy jako zaufanego | wdrożenie wyłącznie w sieci firmowej |

Wybór zapisujesz w kroku 5 jako `SITE_ADDRESS`.

---

## 3. Przygotowanie serwera

Zaloguj się na serwer przez SSH i wykonaj polecenia po kolei.

### 3.1. Sprawdź, czy porty 80 i 443 są wolne

```bash
sudo ss -tlnp | grep -E ':(80|443)\s'
```

**Oczekiwany wynik: brak wypisanych linii.** Jeśli coś się wypisze, na serwerze działa już inny
serwer WWW (np. Apache albo nginx) i trzeba go zatrzymać lub wybrać inny serwer — dwie usługi nie
mogą jednocześnie używać tego samego portu.

### 3.2. Zainstaluj Dockera

```bash
curl -fsSL https://get.docker.com | sudo sh
```

Instalacja trwa 1–3 minuty. Następnie sprawdź:

```bash
sudo docker --version && sudo docker compose version
```

**Oczekiwany wynik:** dwie linie z numerami wersji, np. `Docker version 27.x` oraz
`Docker Compose version v2.x`. Wersja Compose musi zaczynać się od **v2** — polecenia w tym
poradniku używają składni `docker compose` (ze spacją), której starsze wydania nie znają.

### 3.3. Pozwól sobie używać Dockera bez `sudo` (wygodne, opcjonalne)

```bash
sudo usermod -aG docker $USER
```

Po tym poleceniu **wyloguj się i zaloguj ponownie**, żeby zmiana zadziałała. Jeśli pominiesz ten
krok, dopisuj `sudo` przed każdym `docker …` w dalszej części poradnika.

Sprawdzenie:

```bash
docker ps
```

**Oczekiwany wynik:** nagłówek tabeli (`CONTAINER ID   IMAGE   …`) bez błędu o odmowie dostępu.

---

## 4. Wgranie aplikacji na serwer

Umieścimy aplikację w `/opt/nieobecnosci` — tę ścieżkę zakładają gotowe pliki automatycznego
backupu, więc trzymanie się jej oszczędza późniejszych poprawek.

```bash
sudo mkdir -p /opt/nieobecnosci
sudo chown $USER:$USER /opt/nieobecnosci
git clone https://github.com/Bartes74/rejestr_nieobecnosci.git /opt/nieobecnosci
cd /opt/nieobecnosci
```

Jeśli serwer nie ma dostępu do repozytorium, spakuj katalog projektu na swoim komputerze
i skopiuj go poleceniem `scp`, a następnie rozpakuj w `/opt/nieobecnosci`.

Sprawdzenie:

```bash
ls docker-compose.prod.yml Caddyfile .env.prod.example
```

**Oczekiwany wynik:** wypisane trzy nazwy plików. Jeśli pojawi się `No such file or directory`,
jesteś w złym katalogu albo kopiowanie było niepełne.

> **Od tej chwili wszystkie polecenia wykonujesz w katalogu `/opt/nieobecnosci`.** Po każdym
> ponownym zalogowaniu na serwer zacznij od `cd /opt/nieobecnosci`.

---

## 5. Plik konfiguracyjny `.env.prod`

To jedyny plik, który wypełniasz ręcznie. Zawiera hasła, więc **nigdy nie trafia do repozytorium**
(jest w `.gitignore`).

### 5.1. Utwórz plik z szablonu

```bash
cp .env.prod.example .env.prod
```

### 5.2. Wygeneruj trzy sekrety

Wykonaj polecenie i **zachowaj wynik** — będziesz go za chwilę wklejać:

```bash
echo "HASLO_BAZY:      $(openssl rand -hex 16)"
echo "HASLO_APLIKACJI: $(openssl rand -hex 16)"
echo "JWT_SECRET:      $(openssl rand -hex 32)"
```

Trzy różne, losowe ciągi. Nie wymyślaj ich samodzielnie i nie używaj tego samego w dwóch miejscach.

### 5.3. Wypełnij plik

```bash
nano .env.prod
```

Poniżej znaczenie każdej pozycji. W nawiasach kwadratowych wpisz swoje wartości.

| Zmienna | Co wpisać | Uwagi |
| --- | --- | --- |
| `NODE_ENV` | `production` | zostaw bez zmian |
| `POSTGRES_PASSWORD` | `[HASLO_BAZY]` | hasło właściciela bazy |
| `DATABASE_URL` | `postgresql://nieobecnosci_app:[HASLO_APLIKACJI]@db:5432/nieobecnosci?schema=public` | konto **robocze** aplikacji |
| `MIGRATE_DATABASE_URL` | `postgresql://nieobecnosci:[HASLO_BAZY]@db:5432/nieobecnosci?schema=public` | konto **właściciela**, tylko do aktualizacji struktury |
| `JWT_SECRET` | `[JWT_SECRET]` | podpisuje sesje użytkowników |
| `SCHEDULER_ENABLED` | `true` | nocne przypomnienia o zaległym urlopie |
| `SITE_ADDRESS` | Twój adres z rozdziału 2 | np. `absencje.firma.example` |
| `SMTP_ENABLED` | `true` albo `false` | `false` = aplikacja działa, ale nie wysyła e-maili |
| `SMTP_HOST` / `SMTP_PORT` | dane z działu IT | np. `smtp.firma.example` / `25` |
| `SMTP_FROM` | adres nadawcy | np. `nieobecnosci@firma.example` |

Zapisz plik: `Ctrl+O`, `Enter`, potem `Ctrl+X`.

### 5.4. Zabezpiecz plik przed odczytem

```bash
chmod 600 .env.prod
```

### 5.5. Dlaczego dwa konta do bazy

To wygląda na komplikację, a jest zabezpieczeniem, którego nie da się obejść z poziomu aplikacji.

Aplikacja prowadzi **dziennik audytu** — zapis kto, kiedy i czyje dane oglądał lub zmieniał
(istotne przy zwolnieniach lekarskich). Gdyby aplikacja łączyła się z bazą jako właściciel, mogłaby
ten dziennik skasować. Dlatego pracuje na koncie `nieobecnosci_app`, które **może do dziennika
dopisywać i czytać, ale nie może w nim nic zmienić ani usunąć** — i nie może samo sobie tego prawa
przywrócić, bo nie jest właścicielem tabeli. Konto właściciela służy wyłącznie do aktualizacji
struktury bazy przy wdrożeniu nowej wersji.

**Wariant uproszczony.** Jeśli chcesz na start pominąć ten mechanizm: w `DATABASE_URL` wpisz dane
właściciela (`nieobecnosci` + `[HASLO_BAZY]`), a linię `MIGRATE_DATABASE_URL` usuń lub zakomentuj
znakiem `#`. Aplikacja zadziała, a Ty pomijasz krok 6.4. Cena: dziennik audytu da się wyczyścić.
**Do produkcji zalecany jest wariant pełny.**

---

## 6. Pierwsze uruchomienie

### 6.1. Zbuduj i uruchom

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

**To potrwa 5–15 minut** — Docker pobiera obrazy i buduje aplikację. Zobaczysz dużo tekstu; to
normalne. Polecenie kończy się listą trzech usług ze słowem `Started`.

### 6.2. Sprawdź, co się uruchomiło

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

**Oczekiwany wynik:** trzy wiersze — `db`, `api`, `web`.

- `db` powinien mieć status `Up (healthy)`
- `web` powinien mieć `Up`
- `api` — patrz niżej

### 6.3. Jeśli `api` się restartuje — tak ma być

**W wariancie pełnym (dwa konta) jest to spodziewane i nie oznacza awarii.** Aplikacja próbuje
połączyć się jako `nieobecnosci_app`, a to konto jeszcze nie istnieje — założymy je w kolejnym
kroku. Do tego czasu `api` będzie się restartować w kółko.

W logach zobaczysz wtedy komunikat o nieudanym uwierzytelnieniu użytkownika `nieobecnosci_app`:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail 20 api
```

Struktura bazy została już jednak utworzona (robi to konto właściciela), więc można iść dalej.

### 6.4. Załóż konto robocze aplikacji

> Ten krok **pomijasz**, jeśli wybrałeś wariant uproszczony z punktu 5.5.

Wpisz to samo hasło, które podałeś jako `[HASLO_APLIKACJI]` w `DATABASE_URL` — w miejsce
`TU_HASLO_APLIKACJI`, **zachowując apostrofy i cudzysłowy**:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db \
  psql -U nieobecnosci -d nieobecnosci -v haslo="'TU_HASLO_APLIKACJI'" < scripts/db-appuser.sql
```

**Oczekiwany wynik:** na końcu pojawia się linia:

```
NOTICE:  Dziennik audytu: zapis i odczyt tak, modyfikacja i kasowanie nie.
```

To potwierdzenie, że zabezpieczenie zadziałało. Jeśli zamiast tego zobaczysz `ERROR`, hasło zostało
wpisane niezgodnie ze wzorem — sprawdź apostrofy i powtórz.

### 6.5. Uruchom aplikację ponownie

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml restart api
```

Odczekaj około 30 sekund, po czym sprawdź:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

**Oczekiwany wynik:** `api` ma status `Up` (po chwili `Up (healthy)`) i **nie** przybywa mu
restartów.

---

## 7. Napełnienie bazy w nowym miejscu

Struktura bazy powstała sama przy pierwszym starcie (migracje wykonuje kontener `api`), ale
**danych w niej nie ma żadnych**. Trzeba je teraz wprowadzić — i tu drogi się rozchodzą.

| Twoja sytuacja | Wybierz |
| --- | --- |
| Stawiasz aplikację od zera, nie ma skąd przenosić danych | [7.1 Seed](#71-wariant-a--nowa-instalacja-seed) |
| Aplikacja już gdzieś działa i chcesz przenieść jej dane | [7.3 Przeniesienie](#73-wariant-b--przeniesienie-danych-z-istniejącej-instalacji) |
| Stawiasz instancję **testową** i chcesz danych na pokaz | [7.4 Dane demo](#74-instancja-testowa--dane-demonstracyjne) |

> **Nie łącz wariantów A i B.** Jeśli przenosisz dane, seed jest niepotrzebny — przeniesione konta
> i tak już tam są.

### 7.1. Wariant A — nowa instalacja (seed)

> **To najczęściej pomijany krok.** Bez niego **nikt się nie zaloguje**, a ekran logowania będzie
> odrzucał każde hasło — i będzie to wyglądać na zepsutą aplikację.

```bash
cd /opt/nieobecnosci
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api node prisma/seed.mjs
```

**Oczekiwany wynik:**

```
• Administrator: login "admin", hasło "admin" — ZMIEŃ po pierwszym logowaniu.
```

Jeśli polecenie nic nie wypisze, konto administratora **już istnieje** — seed niczego wtedy nie
zmienia. To normalne przy powtórnym uruchomieniu.

### 7.2. Co seed tworzy, a czego nie

Seed daje **absolutne minimum, żeby móc się zalogować i zacząć pracę**. Nie zna Twojej organizacji,
więc jej nie wymyśla.

| Tworzy | Nie tworzy |
| --- | --- |
| konto administratora `admin` / `admin` | pracowników |
| typy nieobecności: **Nieobecność** i **L4** | struktury organizacyjnej (piony, Tribe'y, squady) |
| domyślną pulę urlopu: **26 dni** | kalendarza świąt |
| | sprintów |

Resztę wprowadzasz sam — patrz [8.4](#84-wprowadź-dane-organizacji). Świąt nie trzeba wpisywać
ręcznie: aplikacja wylicza je sama, bez połączenia z internetem.

Seed jest **idempotentny** — wolno go uruchomić ponownie kiedykolwiek. Nie zdubluje typów, nie
skasuje danych i **nie nadpisze zmienionego hasła administratora**. Warto go powtórzyć po
aktualizacji, która dokłada nowe ustawienia domyślne.

Sprawdzenie, że zadziałał:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db \
  psql -U nieobecnosci -d nieobecnosci -c \
  'SELECT (SELECT count(*) FROM "Employee") AS konta, (SELECT count(*) FROM "AbsenceType") AS typy;'
```

**Oczekiwany wynik:** `konta = 1`, `typy = 2`.

### 7.3. Wariant B — przeniesienie danych z istniejącej instalacji

Przenosimy zawartość bazy ze starego serwera na nowy. Aplikacja na nowym serwerze musi już
działać (rozdziały 1–6).

#### Krok 1 — na STARYM serwerze: zatrzymaj zapisy i zrób zrzut

Zatrzymanie aplikacji gwarantuje, że nikt nie wprowadzi wpisu, który nie zdąży się przenieść.

```bash
cd /opt/nieobecnosci                       # katalog starej instalacji
docker compose --env-file .env.prod -f docker-compose.prod.yml stop api web
scripts/backup.sh /var/backups/nieobecnosci
ls -1t /var/backups/nieobecnosci/ | head -1     # nazwa świeżego pliku
```

#### Krok 2 — przenieś plik na nowy serwer

```bash
scp /var/backups/nieobecnosci/[NAZWA_PLIKU].sql.gz uzytkownik@nowy-serwer:/tmp/
```

#### Krok 3 — na NOWYM serwerze: wgraj dane

> **Dlaczego baza jest kasowana i zakładana od nowa.** Zrzut niesie własną strukturę tabel,
> a nowa instalacja ma ją już utworzoną przez migracje. Wgranie zrzutu „na wierzch" kończy się
> kilkudziesięcioma błędami `already exists` i — co gorsza — **dane w ogóle się nie przenoszą**,
> mimo że polecenie wygląda na wykonane. Sprawdzone: przy niepustych tabelach wchodzi 0 wierszy.

```bash
cd /opt/nieobecnosci
DC="docker compose --env-file .env.prod -f docker-compose.prod.yml"

# a) zatrzymaj aplikację, żeby zwolniła połączenia do bazy
$DC stop api web

# b) skasuj i załóż bazę od nowa
$DC exec -T db psql -U nieobecnosci -d postgres -c "DROP DATABASE IF EXISTS nieobecnosci;"
$DC exec -T db psql -U nieobecnosci -d postgres -c "CREATE DATABASE nieobecnosci;"

# c) wgraj zrzut
gunzip -c /tmp/[NAZWA_PLIKU].sql.gz | $DC exec -T db psql -U nieobecnosci -q nieobecnosci
```

W trakcie punktu (c) mogą pojawić się komunikaty `role "nieobecnosci_app" does not exist` — to
normalne i nieszkodliwe. Zrzut niesie **uprawnienia** dla roli aplikacji, ale nie samą rolę;
zakłada ją następny krok.

#### Krok 4 — odtwórz rolę aplikacji i jej uprawnienia

**Tego kroku nie wolno pominąć.** Skasowanie bazy usunęło wszystkie nadane w niej uprawnienia, więc
bez niego `api` będzie się restartować w kółko.

```bash
$DC exec -T db psql -U nieobecnosci -d nieobecnosci -v haslo="'TU_HASLO_APLIKACJI'" \
  < scripts/db-appuser.sql
```

**Oczekiwany wynik:** `NOTICE: Dziennik audytu: zapis i odczyt tak, modyfikacja i kasowanie nie.`

> Pomijasz ten krok, jeśli wybrałeś wariant uproszczony z punktu 5.5 (jedno konto do bazy).

#### Krok 5 — uruchom i policz

```bash
$DC start api web
$DC exec -T db psql -U nieobecnosci -d nieobecnosci -c \
  'SELECT (SELECT count(*) FROM "Employee") AS pracownicy, (SELECT count(*) FROM "Absence") AS nieobecnosci;'
```

**Porównaj te liczby z tymi samymi ze starego serwera** — muszą się zgadzać co do jednego wiersza.
Dopiero potem zaloguj się i sprawdź kilka ekranów.

#### Krok 6 — dopiero teraz wyłącz stary serwer

Zostaw go wyłączony, ale **nietknięty** przez co najmniej tydzień. Gdyby coś się nie przeniosło,
to jedyne miejsce, z którego da się to odzyskać.

### 7.4. Instancja testowa — dane demonstracyjne

Do szkoleń i pokazów jest gotowy scenariusz: 23 osoby, struktura Pion › Departament › Tribe ›
5 squadów, sprinty i nieobecności liczone **względem dnia uruchomienia**.

> **Nigdy na serwerze produkcyjnym.** `demo-seed.mjs` **kasuje całą zawartość bazy** przed
> wgraniem danych pokazowych. Dlatego jest celowo wykluczony z obrazu produkcyjnego — z poziomu
> kontenera go nie uruchomisz. Można go odpalić wyłącznie z katalogu repozytorium, więc uważaj,
> przeciwko której bazie akurat stoisz.

Loginy w danych demo: `admin`/`admin` oraz `dyrektor`, `pmo`, `lider`, `po`, `pracownik` —
wszystkie z hasłem `demo123`.

---

## 8. Pierwsze logowanie

### 8.1. Sprawdź serwer aplikacji

To polecenie pyta aplikację o jej kondycję od środka — dokładnie tak, jak robi to automatyczna
sonda Dockera. Działa niezależnie od adresu i certyfikatów, więc **od niego zaczynaj każdą
diagnozę**:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api \
  node -e "fetch('http://localhost:3000/api/health').then(r=>r.text()).then(console.log)"
```

**Oczekiwany wynik:**

```json
{"status":"ok","db":"ok","uptimeSec":123,"version":"1.0"}
```

Kluczowe są `"status":"ok"` **oraz** `"db":"ok"` — to drugie znaczy, że baza odpowiada. Jeśli
widzisz `503` albo polecenie nic nie zwraca, przejdź do rozdziału 11.

### 8.1b. Sprawdź drogę przez serwer WWW

Serwer WWW odpowiada **wyłącznie na adres wpisany w `SITE_ADDRESS`** — dlatego `https://localhost`
nie zadziała, jeśli ustawiłeś tam domenę. Podstaw swój adres:

```bash
curl -sk --resolve [TWÓJ_SITE_ADDRESS]:443:127.0.0.1 https://[TWÓJ_SITE_ADDRESS]/api/health
```

(`--resolve` każe pytać własny serwer, nawet jeśli DNS jeszcze nie wskazuje tutaj; `-k` pomija
ostrzeżenie o certyfikacie wewnętrznym.)

**Oczekiwany wynik:** ta sama odpowiedź co wyżej. Jeśli 8.1 działa, a 8.1b nie — problem jest
w serwerze WWW, adresie lub certyfikacie, a nie w aplikacji (rozdział 11).

### 8.2. Otwórz w przeglądarce

Wejdź na `https://[TWÓJ_SITE_ADDRESS]`. Powinien pojawić się ekran logowania z zielonym panelem
po lewej stronie.

Zaloguj się: **`admin`** / **`admin`**.

### 8.3. Natychmiast zmień hasło administratora

Dopóki tego nie zrobisz, do systemu z danymi kadrowymi może wejść **każdy, kto zna adres**.

1. Wejdź w **Pracownicy i struktura** (menu po lewej).
2. Odszukaj wiersz „Administrator Systemu".
3. Kliknij **Hasło** w kolumnie Akcje.
4. Wpisz nowe hasło dwukrotnie (min. 8 znaków) i zatwierdź.

Wyloguj się i zaloguj ponownie nowym hasłem — to potwierdzi, że zmiana zadziałała.

### 8.4. Wprowadź dane organizacji

W zakładce **Konfiguracja** (widocznej tylko dla administratora) uzupełnij w tej kolejności:

1. **Typy nieobecności** — sprawdź, czy dwa domyślne wystarczają; kolejność ustawiasz strzałkami.
2. **Pula nieobecności** — domyślna liczba dni urlopu; osobno dla UoP, B2B i OUT, jeśli się różnią.
3. **Struktura organizacyjna** — piony, departamenty, Tribe'y i squady.
4. **Święta i dni wolne** — załóż kalendarz i użyj przycisku **Wczytaj święta w Polsce**
   (działa bez internetu, wylicza je aplikacja).
5. **Sprinty** — jeśli korzystacie z widoku pokrycia sprintów.

Pracowników dodaj pojedynczo (**Pracownicy → Dodaj**) albo wczytaj z pliku `.xlsx`
(**Import .xlsx** — nazwy kolumn możesz dopasować do swojego pliku przed wczytaniem).

---

## 9. Kopie zapasowe

**Wdrożenie bez działającej kopii zapasowej nie jest ukończone.** Awaria dysku bez backupu oznacza
utratę całej historii nieobecności.

### 9.1. Wykonaj pierwszą kopię ręcznie

```bash
sudo mkdir -p /var/backups/nieobecnosci
sudo chown $USER:$USER /var/backups/nieobecnosci
cd /opt/nieobecnosci
scripts/backup.sh /var/backups/nieobecnosci
```

**Oczekiwany wynik:** linia w rodzaju
`Backup: /var/backups/nieobecnosci/nieobecnosci-20260812-101500.sql.gz (12K)`.

Skrypt uruchamiaj **z katalogu `/opt/nieobecnosci`** — odnajduje kontener bazy po nazwie projektu,
którą bierze z katalogu.

### 9.2. Włącz kopie codzienne

```bash
sudo cp scripts/nieobecnosci-backup.service scripts/nieobecnosci-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nieobecnosci-backup.timer
```

Sprawdzenie:

```bash
systemctl list-timers nieobecnosci-backup.timer
```

**Oczekiwany wynik:** wiersz z najbliższym uruchomieniem o godzinie **02:00**.

> Jeśli aplikacja **nie** leży w `/opt/nieobecnosci`, przed skopiowaniem popraw ścieżki
> w `nieobecnosci-backup.service` (pozycje `WorkingDirectory` i `ExecStart`).

### 9.3. Kopia poza serwerem — zrób to koniecznie

Kopia leżąca na tym samym serwerze co baza **ginie razem z nim**. W pliku
`/etc/systemd/system/nieobecnosci-backup.service` jest przygotowana linia do odkomentowania:

```
ExecStartPost=/usr/bin/rsync -a /var/backups/nieobecnosci/ kopia@backup-host:/backups/nieobecnosci/
```

Usuń `#` z początku, wpisz swój serwer kopii, następnie `sudo systemctl daemon-reload`.

### 9.4. Raz na kwartał sprawdź, że kopia da się odtworzyć

```bash
cd /opt/nieobecnosci && scripts/restore-test.sh /var/backups/nieobecnosci
```

**Oczekiwany wynik:** `TEST ODTWORZENIA OK ✅` wraz z liczbą odtworzonych rekordów.

Test odtwarza kopię do bazy tymczasowej obok produkcyjnej i sprząta po sobie — **baza
produkcyjna nie jest w żadnym momencie dotykana**. Robi się to dlatego, że kopia, której nikt nigdy
nie odtworzył, ma nieznaną wartość: `pg_dump` kończy się powodzeniem także wtedy, gdy plik da się
później wczytać tylko częściowo.

---

## 10. Codzienna obsługa

Wszystkie polecenia wykonuj w `/opt/nieobecnosci`. Dla skrócenia zapisu warto raz na sesję ustawić:

```bash
alias dc='docker compose --env-file .env.prod -f docker-compose.prod.yml'
```

Dalej używamy pełnej postaci, żeby dało się kopiować bez wcześniejszego aliasu.

| Czynność | Polecenie |
| --- | --- |
| Stan usług | `docker compose --env-file .env.prod -f docker-compose.prod.yml ps` |
| Logi aplikacji (na żywo) | `docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f api` |
| Logi serwera WWW | `docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f web` |
| Restart aplikacji | `docker compose --env-file .env.prod -f docker-compose.prod.yml restart api` |
| Zatrzymanie całości | `docker compose --env-file .env.prod -f docker-compose.prod.yml down` |
| Ponowne uruchomienie | `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d` |
| Sprawdzenie kondycji | polecenie z punktu 8.1 |

Logi przeglądasz klawiszami strzałek, wychodzisz `Ctrl+C`.

### 10.1. Aktualizacja do nowszej wersji

```bash
cd /opt/nieobecnosci
scripts/backup.sh /var/backups/nieobecnosci        # 1. kopia PRZED zmianą
git pull                                            # 2. nowa wersja kodu
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build   # 3. przebudowa
```

Zmiany struktury bazy wykonują się **automatycznie** przy starcie kontenera `api`.

Po aktualizacji sprawdź kondycję (punkt 8.1) i zaloguj się do aplikacji.

> **Jeśli aktualizacja dodała nową tabelę** — powtórz krok 6.4 (skrypt `db-appuser.sql`). Nadaje on
> uprawnienia nowym tabelom; jest bezpieczny przy powtórzeniu. Objaw pominięcia: aplikacja zgłasza
> błąd uprawnień przy korzystaniu z nowej funkcji.

### 10.2. Wycofanie nieudanej aktualizacji

```bash
cd /opt/nieobecnosci
git log --oneline -5                 # znajdź poprzednią wersję
git checkout [IDENTYFIKATOR]         # np. abe66cc
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Jeśli nowa wersja zdążyła zmienić strukturę bazy, samo cofnięcie kodu może nie wystarczyć —
wtedy odtwórz kopię wykonaną przed aktualizacją (rozdział 12).

---

## 11. Gdy coś nie działa

Zacznij **zawsze** od tych dwóch poleceń — odpowiadają na 90% pytań:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail 50 api
```

| Objaw | Najczęstsza przyczyna | Co zrobić |
| --- | --- | --- |
| `api` restartuje się w kółko, w logach `password authentication failed for user "nieobecnosci_app"` | Nie wykonano kroku 6.4 albo hasło w `DATABASE_URL` nie zgadza się z tym podanym skryptowi | Powtórz krok 6.4 tym samym hasłem, potem 6.5 |
| `api` nie startuje, w logach `Brak wymaganych zmiennych środowiskowych: JWT_SECRET` | Pusty lub brakujący `JWT_SECRET` w `.env.prod` | Uzupełnij (`openssl rand -hex 32`) i `up -d` |
| Ekran logowania odrzuca `admin`/`admin` | Nie wykonano kroku 7 (brak konta w bazie) | Wykonaj krok 7 |
| Strona się nie otwiera, przeglądarka nie łączy | Zajęty port 80/443 albo zapora | Krok 3.1; sprawdź zaporę firmową |
| Ostrzeżenie „połączenie niezaufane" | Adres wewnętrzny — certyfikat własny Caddy | Normalne (rozdział 2). Aby usunąć, dział IT musi rozdystrybuować certyfikat Caddy |
| Adres publiczny, a certyfikatu brak | Port 80 niedostępny z internetu, więc Let's Encrypt nie potwierdził domeny | Otwórz port 80; sprawdź `logs web` |
| `{"status":"error"}` lub `503` z `/api/health` | Baza nie odpowiada | `ps` — czy `db` ma `healthy`; `logs db` |
| Nie przychodzą e-maile | `SMTP_ENABLED=false` albo błędny host | Popraw `.env.prod`, potem `restart api`. Aplikacja działa normalnie bez poczty |
| Brak miejsca na dysku | Stare obrazy Dockera | `docker system prune -a` (usuwa nieużywane obrazy; **nie rusza wolumenu z danymi**) |

Jeśli musisz zgłosić problem dalej, dołącz wynik:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail 100 api
```

---

## 12. Odtworzenie po awarii

Postępuj tak, gdy dane zostały utracone lub uszkodzone i trzeba wrócić do stanu z kopii.

> **Bazę kasujemy i zakładamy od nowa — to nie jest nadgorliwość.** Zrzut niesie własną strukturę
> tabel. Wgrany do bazy, w której tabele już są (a są zawsze, bo migracje wykonują się przy każdym
> starcie), kończy się kilkudziesięcioma błędami `already exists`. Gorsze jest to, co dzieje się
> przy okazji: jeśli w tabelach są jakiekolwiek dane, **nie wgra się ani jeden wiersz z kopii**,
> a polecenie i tak dobiegnie do końca. Łatwo wtedy uznać, że odtworzenie się powiodło.

```bash
cd /opt/nieobecnosci
DC="docker compose --env-file .env.prod -f docker-compose.prod.yml"

# 1. Zatrzymaj aplikację, żeby zwolniła połączenia do bazy
$DC stop api web

# 2. Wskaż kopię (najnowsza na górze listy)
ls -1t /var/backups/nieobecnosci/

# 3. Skasuj i załóż bazę od nowa
$DC exec -T db psql -U nieobecnosci -d postgres -c "DROP DATABASE IF EXISTS nieobecnosci;"
$DC exec -T db psql -U nieobecnosci -d postgres -c "CREATE DATABASE nieobecnosci;"

# 4. Wczytaj wybraną kopię
gunzip -c /var/backups/nieobecnosci/[NAZWA_PLIKU].sql.gz | \
  $DC exec -T db psql -U nieobecnosci -q nieobecnosci

# 5. Odtwórz uprawnienia roli aplikacji — zginęły razem z bazą.
#    (Pomijasz, jeśli używasz wariantu uproszczonego z punktu 5.5.)
$DC exec -T db psql -U nieobecnosci -d nieobecnosci -v haslo="'TU_HASLO_APLIKACJI'" \
  < scripts/db-appuser.sql

# 6. Uruchom aplikację ponownie
$DC start api web

# 7. Sprawdź kondycję (polecenie z punktu 8.1) i policz wiersze
$DC exec api node -e "fetch('http://localhost:3000/api/health').then(r=>r.text()).then(console.log)"
$DC exec -T db psql -U nieobecnosci -d nieobecnosci -c \
  'SELECT (SELECT count(*) FROM "Employee") AS pracownicy, (SELECT count(*) FROM "Absence") AS nieobecnosci;'
```

Liczby z punktu 7 muszą być niezerowe — zero pracowników znaczy, że kopia się nie wczytała, choć
polecenia przeszły. Następnie zaloguj się i potwierdź, że dane są na miejscu.

**Ile danych stracisz:** wszystko, co wprowadzono **po** wykonaniu tej kopii. Przy kopii
codziennej o 02:00 to maksymalnie 24 godziny pracy.

---

## 13. Czego nie wolno robić

| Nigdy | Dlaczego |
| --- | --- |
| Nie uruchamiaj na produkcji `apps/api/demo-seed.mjs` | **Kasuje całą bazę** i wgrywa dane demonstracyjne |
| Nie uruchamiaj na produkcji `apps/api/verify-*.mjs` ani `run-verify.mjs` | Suity testowe **czyszczą bazę** przed przebiegiem |
| Nie uruchamiaj `docker compose down -v` | Przełącznik `-v` **kasuje wolumen z danymi** |
| Nie uruchamiaj na tym serwerze `docker-compose.yml` (bez `.prod`) | To konfiguracja deweloperska; polecenia backupu mogłyby trafić w niewłaściwą bazę |
| Nie umieszczaj `.env.prod` w repozytorium | Zawiera hasła i sekret sesji |
| Nie zostawiaj hasła `admin`/`admin` | Otwiera dostęp do danych kadrowych każdemu, kto zna adres |

Dwa pierwsze skrypty są celowo **wykluczone z obrazu produkcyjnego** — z poziomu kontenera ich nie
uruchomisz. Niebezpieczne jest odpalenie ich z katalogu repozytorium przeciwko bazie produkcyjnej.

---

## 14. Lista kontrolna wdrożenia

Przejdź ją przed przekazaniem aplikacji użytkownikom.

- [ ] `docker compose … ps` pokazuje trzy usługi; `db` i `api` mają `healthy`
- [ ] Sprawdzenie z punktu 8.1 zwraca `"status":"ok"` **i** `"db":"ok"`
- [ ] Sprawdzenie z punktu 8.1b (przez serwer WWW, na docelowym adresie) zwraca to samo
- [ ] Strona otwiera się pod docelowym adresem w przeglądarce
- [ ] Certyfikat jest zaufany (adres publiczny) **lub** dział IT wie o certyfikacie wewnętrznym
- [ ] Hasło administratora **zostało zmienione** z `admin`
- [ ] Testowy wpis nieobecności zapisuje się i widać go w kalendarzu zespołu

**Instalacja od zera (wariant A):**

- [ ] Seed wykonany — sprawdzenie z 7.2 pokazuje `konta = 1`, `typy = 2`
- [ ] Typy nieobecności, pula urlopu i kalendarz świąt są uzupełnione
- [ ] Struktura organizacyjna i pracownicy są wprowadzeni

**Przeniesienie danych (wariant B):**

- [ ] Liczba pracowników i nieobecności na nowym serwerze **zgadza się ze starym**
- [ ] Skrypt `db-appuser.sql` powtórzony po odtworzeniu bazy (krok 7.3/4)
- [ ] `api` ma status `Up (healthy)` i nie przybywa mu restartów
- [ ] Stary serwer wyłączony, ale **zachowany** przez co najmniej tydzień
- [ ] `scripts/backup.sh` wykonał się i utworzył plik
- [ ] `systemctl list-timers nieobecnosci-backup.timer` pokazuje najbliższe uruchomienie
- [ ] Kopia poza serwerem jest skonfigurowana (punkt 9.3)
- [ ] `scripts/restore-test.sh` zakończył się `TEST ODTWORZENIA OK`
- [ ] Monitoring organizacji odpytuje `https://[ADRES]/api/health` i alarmuje przy kodzie ≠ 200
- [ ] Wdrożenie uzgodnione z osobą odpowiedzialną za ochronę danych osobowych

---

## Skąd czerpać dalej

| Zagadnienie | Gdzie |
| --- | --- |
| Jak aplikacja liczy urlop, okresy i pokrycie | `README.md` |
| Zasady bezpieczeństwa i uprawnień | `README.md`, rozdział „Bezpieczeństwo" |
| Wygląd i zasady interfejsu | `DESIGN.md` |
| Zakres funkcjonalny i stan prac | `PRODUCT.md`, `Backlog - aplikacja nieobecnosci.xlsx` |
| Uruchomienie na komputerze programisty | `README.md`, rozdział „Uruchomienie (dev)" |
