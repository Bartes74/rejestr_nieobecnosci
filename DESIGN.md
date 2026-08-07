---
name: Nieobecności
description: Cichy rejestr — spokojny, gęsty system dla wewnętrznej aplikacji nieobecności regulowanej instytucji finansowej.
colors:
  brand: "#007A53"
  brand-dark: "#006A4E"
  brand-tint: "#E1F0E9"
  on-brand: "#FFFFFF"
  on-danger: "#FFFFFF"
  canvas: "#EAEEEC"
  surface: "#FFFFFF"
  surface-2: "#F5F8F6"
  surface-3: "#EEF3F0"
  border: "#E1E7E4"
  border-2: "#838A88"
  ink: "#15201C"
  ink-2: "#3C4A45"
  muted: "#636E69"
  blue: "#1F729B"
  blue-tint: "#E2EEF3"
  amber: "#946502"
  amber-tint: "#F8EED4"
  danger: "#C81F2D"
  danger-tint: "#FAE4E6"
  absence: "#CFE6DC"
  absence-ink: "#005C3F"
  absence-border: "#A6D2BF"
  heat-1: "#D9EBDD"
  heat-2: "#A8D9B4"
  heat-3: "#F1DC8E"
  heat-4: "#ED9F52"
  heat-5: "#D34437"
  heat-1-ink: "#1C6B49"
  heat-2-ink: "#13593A"
  heat-3-ink: "#735312"
  heat-4-ink: "#5E2F08"
  heat-5-ink: "#FFFFFF"
  heat-5-ring: "#640100"
typography:
  display:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "58px"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.03em"
    fontFeature: "tabular-nums"
  headline:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "23px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "10.5px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.04em"
rounded:
  sm: "7px"
  md: "10px"
  lg: "14px"
  xl: "16px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.md}"
    padding: "11px 16px"
  button-primary-hover:
    backgroundColor: "{colors.brand-dark}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.md}"
    padding: "11px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "11px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.brand}"
    rounded: "{rounded.md}"
    padding: "11px 16px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-danger}"
    rounded: "{rounded.md}"
    padding: "11px 16px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "9px 11px"
  nav-item-active:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand}"
    rounded: "{rounded.sm}"
    padding: "9px 11px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "22px"
  stat-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  segmented-item-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand}"
    rounded: "{rounded.sm}"
    padding: "6px 13px"
  absence-pill:
    backgroundColor: "{colors.absence}"
    textColor: "{colors.absence-ink}"
    rounded: "{rounded.sm}"
    padding: "3px 9px"
---

# Design System: Nieobecności

## Overview

**Creative North Star: „Cichy rejestr"**

Księga, w której każdy wpis wygląda tak samo. System nie hierarchizuje ludzi ani powodów — dwa tygodnie urlopu i jeden dzień zwolnienia dostają identyczną pigułkę w identycznym kolorze, bo prawo tego wymaga, a estetyka to podchwytuje i czyni z tego charakter. Powierzchnie są płaskie, linie włoskowate, liczby ustawione monospacem tak, żeby kolumny się zgadzały. Nic nie miga, nic nie świętuje.

Gęstość jest tu cechą, nie kompromisem. To narzędzie dla ludzi, którzy patrzą na nie w oknie planowania sprintu, chcą zobaczyć czterdzieści osób naraz i wyjść. Odstępy są ciasne (rytm 4 px, karty 20–24 px wewnętrznego oddechu), typografia mała (baza 13,5 px), a treść dociąga do 1180 px i nie rozlewa się dalej. Zieleń marki pojawia się rzadko i zawsze coś znaczy: aktywna pozycja nawigacji, akcja główna, wykorzystana część puli.

Kolor jest zarezerwowany dla znaczenia. Neutralne szarości mają lekko zielony podkład, dzięki czemu marka nie wygląda na doklejoną do obcego interfejsu. Jedyne miejsce z prawdziwą skalą sekwencyjną to heatmapa pokrycia — tam kolor koduje ryzyko obsadowe, nie typ nieobecności. Potwierdzona anty-referencja: **Excel w przeglądarce**. Produkt zastępuje arkusz i nie ma prawa go cytować — żadnych siatek obramowanych z każdej strony, żadnych ekranów, na których wszystkie komórki ważą tyle samo.

**Key Characteristics:**

- Jednolitość nieobecności jako reguła wizualna, nie tylko prawna
- Gęsta, spokojna typografia z podziałem: Archivo mówi, IBM Plex Mono liczy
- Kolor wyłącznie jako znaczenie — marka, uwaga, ryzyko; nigdy dekoracja
- Płasko w spoczynku, cień wyłącznie jako reakcja na stan
- Zaokrąglone kwadraty zamiast okręgów; włoskowate obramowania zamiast wypełnień

## Colors

Chłodno-ciepłe szarości z zielonkawym podkładem, jedna pewna zieleń marki i trzy semantyczne sygnały. Wartości w bloku frontmatter dotyczą motywu jasnego (`:root`); motyw ciemny (`[data-theme="dark"]`) jest pełnoprawną drugą warstwą, wypisaną niżej.

### Primary

- **Spokojna Zieleń Marki** (`brand`): tożsamość, akcja główna, aktywna pozycja nawigacji, wykorzystana część paska balansu, kluczowe liczby. Wywodzi się z oficjalnej palety Pantone zamawiającego (P341 / P342) i nie podlega renegocjacji w pracach projektowych. `brand-dark` obsługuje hover i stan wciśnięty; `brand-tint` to miękkie tło pod aktywną nawigacją i znacznikami. `on-brand` i `on-danger` to jedyne kolory treści dopuszczone na nasyconych wypełnieniach; oba odwracają biegun razem z motywem.

### Secondary

- **Stalowy Błękit Danych** (`blue`): wyłącznie wizualizacje, awatary i status „zaplanowane". Nie koduje znaczenia i **nigdy** nie oznacza typu nieobecności. `blue-tint` to jego tło.

### Tertiary

- **Bursztyn Uwagi** (`amber`) i jego tło `amber-tint`: przypomnienia i sytuacje wymagające decyzji, ale nie awaryjne — zaległy urlop, zejście poniżej minimum do pozostawienia.
- **Czerwień Ryzyka** (`danger`) i `danger-tint`: błąd, przekroczenie puli, kolizja kluczowych ról, akcje nieodwracalne.

### Neutral

- **Płótno** (`canvas`): tło aplikacji pod kartami. Nigdy nie jest białe — karty mają się od niego odcinać bez cienia.
- **Powierzchnia** (`surface`): wypełnienie kart, paneli, pól formularza, topbara i sidebara.
- **Wgłębienia** (`surface-2`, `surface-3`): nagłówki tabel, tory pasków postępu, chipy, tła hover, pola nieaktywne.
- **Linie** (`border`, `border-2`): włoskowate podziały (`border`) i krawędź kontrolek interaktywnych (`border-2`). Podział ról ma konsekwencję kontrastową: podziały są dekoracyjne i mogą być ledwie widoczne, ale `border-2` bywa jedyną granicą pola na białym tle, więc trzyma **3:1** względem powierzchni i płótna (WCAG 1.4.11).
- **Atrament** (`ink`, `ink-2`, `muted`): tekst główny, drugorzędny i podpisy. Nigdy czysta czerń — najciemniejszy atrament ma zielonkawy podkład, spójny z płótnem.

### Absence

- **Nieobecność** (`absence`, `absence-ink`, `absence-border`): jeden komplet kolorów dla każdej nieobecności w systemie, niezależnie od typu, długości i osoby.

### Heatmap

- **Skala pokrycia** (`heat-1` → `heat-5`, każdy z własnym `-ink`): jedyna skala sekwencyjna w systemie. Prowadzi od spokojnej zieleni (< 12% nieobecnych) przez żółć i pomarańcz do czerwieni (≥ 50%). `heat-5-ring` to wewnętrzny pierścień na kaflach wysokiego ryzyka.

### Dark theme

| Token | Jasny | Ciemny |
|---|---|---|
| `canvas` | `#EAEEEC` | `#0E1413` |
| `surface` / `surface-2` / `surface-3` | `#FFFFFF` / `#F5F8F6` / `#EEF3F0` | `#18211E` / `#1E2925` / `#243029` |
| `border` / `border-2` | `#E1E7E4` / `#838A88` | `#2B3833` / `#5C6D66` |
| `ink` / `ink-2` / `muted` | `#15201C` / `#3C4A45` / `#636E69` | `#E9F0EC` / `#B5C1BC` / `#889892` |
| `brand` / `brand-dark` / `on-brand` | `#007A53` / `#006A4E` / `#FFFFFF` | `#2FB888` / `#27A579` / `#0E1413` |
| `blue` / `amber` / `danger` | `#1F729B` / `#946502` / `#C81F2D` | `#5DB2D6` / `#E0AC4C` / `#FF5E6B` |
| `heat-1` … `heat-5` | `#D9EBDD` `#A8D9B4` `#F1DC8E` `#ED9F52` `#D34437` | `#323A34` `#3B5B44` `#927F37` `#D08435` `#DE4F40` |
| `absence` / `absence-ink` | `#CFE6DC` / `#005C3F` | `rgba(47,184,136,.20)` / `#7BD9B4` |

Tinty w motywie ciemnym są półprzezroczyste (`rgba(...)`), nie zamrożone na płasko — dzięki temu działają na każdej z trzech powierzchni.

Skala pokrycia w motywie ciemnym jest **komponowana osobno, nie odwrócona**: spokój (`heat-1`) leży blisko powierzchni i ma się w niej rozpływać, natężenie rośnie razem z jasnością, a ryzyko (`heat-5`) jako jedyne świeci. Atrament przeskakuje w połowie skali — kroki 1–2 noszą jasny `#E9F0EC`, kroki 3–5 ciemny `#0E1413` — bo tylko tak każdy kafel utrzymuje 4,5:1 przy zachowanej sekwencji.

### Named Rules

**Reguła jednolitej nieobecności.** Nieobecność ma dokładnie jeden zestaw kolorów. Nigdy nie koduj typu, długości, powodu ani „ważności" wpisu kolorem, ikoną, obramowaniem czy kolejnością. Test: jeśli patrząc na kalendarz można zgadnąć, kto był chory — regułę złamano.

**Reguła jednego głosu.** Zieleń marki zajmuje mniej niż 10% powierzchni ekranu. Jej rzadkość jest tym, co sprawia, że akcja główna jest widoczna bez zwiększania jej rozmiaru.

**Reguła jednej skali.** W całym systemie istnieje jedna skala sekwencyjna i należy do heatmapy pokrycia. Każdy inny wykres używa `brand` i `blue` naprzemiennie, bez gradientu.

**Reguła progu.** Każda para tekst/tło trzyma **4,5:1**, każda krawędź kontrolki i kafel niosący znaczenie — **3:1**, w obu motywach i po skomponowaniu półprzezroczystych tintów. Nowy token nie wchodzi do palety, dopóki nie przejdzie tego rachunku; „wygląda dobrze" nie jest pomiarem. Kolor marki jest wiążący i nie podlega tej regule — to warstwy wokół niego mają się dopasować.

## Typography

**Display Font:** Archivo (fallback: system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Archivo — ten sam krój, cały interfejs
**Label/Mono Font:** IBM Plex Mono (fallback: ui-monospace, SF Mono, Menlo, monospace)

**Character:** Jeden neutralny grotesk o wąskich proporcjach niesie cały interfejs — od 58-punktowego licznika po 11-punktowy podpis — a monospace pilnuje wszystkiego, co się liczy i porównuje. Ten podział jest głównym nośnikiem charakteru: Archivo mówi, Plex liczy.

### Hierarchy

- **Display** (800, 58 px, line-height 0.9, tracking −0.03em, `tabular-nums`): licznik pozostałego urlopu na pulpicie. Jedna liczba, do której sprowadza się cały produkt dla pracownika.
- **Headline** (700, 23 px, tracking −0.01em): powitanie i tytuł ekranu.
- **Title** (700, 16 px): nagłówki sekcji administracyjnych. Tytuły kart schodzą do 14,5 px przy tej samej wadze.
- **Body** (400, 13,5 px, line-height 1.5): tekst ciągły, komórki tabel, opisy. Akapity objaśniające trzymają się ~680 px szerokości.
- **Label** (IBM Plex Mono 700, 10,5 px, tracking 0.04em, WERSALIKI): nagłówki kolumn, mikro-etykiety sekcji, grupy w nawigacji (tam tracking rośnie do 0.13em).

Skala pośrednia: 11 / 12,5 / 13,5 / 14,5 / 16 / 19 / 23 / 34 / 58 px. Wartości ułamkowe są celowe — to skala dostrojona do Archivo, nie zaokrąglona po fakcie.

### Named Rules

**Reguła mono dla danych.** Wszystko, co użytkownik porównuje wzrokiem w pionie — dni, osobodni, procenty, daty, zakresy, identyfikatory, znaczniki czasu — jest ustawione w IBM Plex Mono z `font-variant-numeric: tabular-nums`. Liczba w zdaniu zostaje w Archivo. Test: jeśli dwie liczby stoją jedna nad drugą i ich przecinki się nie pokrywają, użyto złego kroju.

**Reguła jednej wielkiej liczby.** Rozmiar display pojawia się najwyżej raz na ekranie. Drugi taki numer nie tworzy hierarchii, tylko ją kasuje.

**Reguła wersalików tylko w mono.** Wielkie litery są zastrzeżone dla mikro-etykiet w monospace. Nagłówki, przyciski i treść używają zapisu zdaniowego.

## Layout

Powłoka aplikacji jest stała: sidebar 250 px (nierozciągliwy, `position: sticky`, pełna wysokość), topbar 64 px (przyklejony, `z-index` 5), obszar treści przewijany z paddingiem 28–30 px i dolnym zapasem 60 px. Treść dociąga do 1180 px na ekranach szerokich (1080 px tam, gdzie kolumna jest jedna); powyżej tej szerokości rośnie margines, nie kolumny.

Rytm opiera się na siatce 4 px: każdy odstęp jest wielokrotnością czwórki, z dopuszczonym krokiem 6 px tam, gdzie 4 jest za ciasne, a 8 za luźne. Odstępy realizuje `gap` w flexie i gridzie, nie marginesy — to reguła, dzięki której usunięcie elementu nie zostawia dziury. Karty mają 20–24 px wewnętrznego oddechu, panele wewnętrzne 16–18 px, wiersze tabel 12–15 px w pionie i 16–20 px w poziomie.

Siatka jest **regułą przeglądu, nie zmienną CSS**. Skala `--space-*` istniała w arkuszu przez cały czas życia projektu i nie miała ani jednego konsumenta — odstępy w tych ekranach są liczbami w atrybucie `style` i takie zostają. Token, po który nikt nie sięga, nie opisuje systemu, tylko obiecuje coś, czego kod nie robi; został usunięty (2026-08-07). Promienie (`--radius-*`) są odwrotnym przypadkiem: mają realnych konsumentów i obowiązują jako tokeny.

Układy dwukolumnowe używają proporcji ważonych, nie równych: 1,35 fr / 1 fr na pulpicie (balans dominuje nad przypomnieniami), 1,25 fr / 0,95 fr przy nowym wpisie (formularz nad podglądem), 268 px / 1 fr w administracji (drzewo organizacji jest wąskie i stałe). Kafle capacity układają się w `auto-fill` z minimum 280 px.

Aplikacja jest **desktop-only** — decyzja produktowa, nie przeoczenie. W systemie istnieje jeden breakpoint (860 px) i służy wyłącznie ukryciu panelu marki na ekranie logowania, który jako jedyna powierzchnia działa na wąskim ekranie. Nowe prace nie muszą projektować układów mobilnych, ale nie wolno im też dodawać sztywnych szerokości poza wymienionymi: jeśli coś może być elastyczne bez kosztu, ma być.

**Uwaga o adopcji:** w warstwie tokenów nie ma już deklaracji bez konsumenta. `--control-h` (minimalny cel dotykowy) został usunięty razem ze skalą odstępów — aplikacja jest desktop-only, więc czekał na konsumenta, którego nie miało być. Minimalny rozmiar celu wskaźnika obowiązuje jako reguła przeglądu: **24 × 24 px** (WCAG 2.5.8), egzekwowane przy okazji audytu, nie zmienną CSS.

### Named Rules

**Reguła 1180.** Treść nigdy nie przekracza 1180 px. Szeroki monitor daje więcej marginesu, nie dłuższe wiersze.

**Reguła gapu.** Odstępy między elementami tworzy `gap` kontenera. Marginesy na dzieciach są dopuszczalne tylko tam, gdzie kontener nie jest własnością tego samego komponentu.

## Elevation & Depth

Hierarchia spoczynkowa jest **tonalna**, nie cieniowana: `canvas` pod spodem, `surface` dla kart, `surface-2` i `surface-3` dla wgłębień, torów i chipów — plus włoskowate obramowanie 1 px, które robi tu robotę, jaką w innych systemach robi cień. Cień pojawia się dopiero jako **odpowiedź na stan**: coś się otworzyło, uniosło albo zostało wybrane.

### Shadow Vocabulary

- **Spoczynkowy** (`box-shadow: 0 1px 2px rgba(16,40,32,.07)`): karty, przyciski główne, aktywny segment kontrolki segmentowej. Ma być niezauważalny — domyka krawędź, nie unosi.
- **Uniesiony** (`box-shadow: 0 8px 28px rgba(16,40,32,.10)`): wyłącznie elementy nakładające się na treść — popover powiadomień, dialog, toast, rozwinięta lista wyboru.
- W motywie ciemnym oba pogłębiają się do `0 1px 2px rgba(0,0,0,.35)` i `0 12px 34px rgba(0,0,0,.45)`, bo ciemne tło pochłania rozproszenie.

### Named Rules

**Reguła cienia jako odpowiedzi.** W spoczynku powierzchnia jest płaska. Cień „uniesiony" należy się wyłącznie temu, co naprawdę nakłada się na treść pod spodem. Nowa karta z mocnym cieniem to błąd, nie akcent.

## Shapes

Język form jest miękki, ale nigdy okrągły. Promienie rosną z rozmiarem elementu: drobne kafle, pigułki, chipy i pozycje nawigacji 7 px (`rounded.sm`), kontrolki i pola 10 px (`rounded.md`), panele wewnętrzne 14 px (`rounded.lg`), karty i tabele 16 px (`rounded.xl`). Cztery stopnie, bez piątego — osobny promień „pigułkowy" nie miał konsumenta i kusił, żeby ta sama pigułka wyglądała inaczej na dwóch ekranach.

Obramowania są zawsze włoskowate — 1 px, nigdy grubsze. Wyjątek jest jeden i celowy: aktywny segment wyboru wymiaru dnia dostaje 1,5 px w kolorze marki, żeby stan zaznaczenia był czytelny bez wypełnienia. Kafle wysokiego ryzyka w heatmapie używają wewnętrznego pierścienia (`inset 0 0 0 2px`) zamiast zewnętrznego obramowania, żeby nie rozsuwać siatki.

Tabele i listy żyją wewnątrz kart z `overflow: hidden`, dzięki czemu wiersze przycinają się do promienia karty i nie potrzebują własnych zaokrągleń.

### Named Rules

**Reguła zaokrąglonego kwadratu.** Awatary, kafle ikon i znak produktu to zaokrąglone kwadraty (promień ≈ 26% boku), nigdy okręgi. Okrąg w tym systemie ma tylko jedno zastosowanie: kropka statusu o średnicy 6–7 px.

**Reguła jednego piksela.** Każdy podział to 1 px. Grubsza linia oznacza, że próbujesz zbudować hierarchię obramowaniem — zbuduj ją tonalnie.

## Components

Charakter całej rodziny: **precyzyjne i powściągliwe**. Krawędzie robią robotę, nie wypełnienia; każdy element wygląda na dokładnie wymierzony i nie jest widoczny bardziej, niż musi.

### Buttons

- **Shape:** miękko zaokrąglone (10 px), bez cienia poza wariantem głównym.
- **Primary:** wypełnienie marką, treść w `on-brand`, padding 11 × 16 px (11–13 px w pionie zależnie od rozmiaru), waga 700, spoczynkowy cień. Ikona 15–16 px przed etykietą, odstęp 7 px.
- **Hover / Focus:** tło schodzi do `brand-dark` w 140 ms; fokus z klawiatury dostaje globalny pierścień 2 px w kolorze marki z odsunięciem 2 px.
- **Secondary:** powierzchnia z obramowaniem `border-2`, treść `ink-2`. To domyślny wybór dla wszystkiego, co nie jest akcją główną ekranu.
- **Ghost:** przezroczysty, treść w kolorze marki — do akcji nawigacyjnych w nagłówkach kart („Kalendarz ›").
- **Tint:** tło `brand-tint` z obramowaniem w kolorze marki — dla akcji ważnych, ale nie głównych (eksport raportu).
- **Danger:** wypełnienie `danger` — wyłącznie dla operacji nieodwracalnych.
- **Disabled:** przezroczystość 0,55 i kursor `not-allowed`; kształt i kolor bez zmian.

### Chips

- **Absence pill:** monospace 12 px, tło `absence`, treść `absence-ink`, obramowanie `absence-border`, padding 3 × 9 px, promień 7 px, bez zawijania. Jedyny wygląd nieobecności w całym systemie.
- **Badge:** ten sam kształt w pięciu tonach (neutralny, marka, błękit, bursztyn, czerwień) — tło tintem, treść pełnym kolorem, opcjonalna kropka 6 px w `currentColor`.

### Cards / Containers

- **Corner Style:** 16 px dla kart głównych, 14 px dla paneli wewnętrznych.
- **Background:** `surface` na tle `canvas`; wgłębienia w `surface-2`.
- **Shadow Strategy:** wyłącznie cień spoczynkowy (patrz Elevation & Depth).
- **Border:** 1 px `border`, zawsze.
- **Internal Padding:** 20–24 px; nagłówek karty oddziela od treści 12–14 px, nie linia.

### Inputs / Fields

- **Style:** powierzchnia z obramowaniem `border-2` (mocniejszym niż podziały, bo pole trzeba znaleźć wzrokiem), promień 10 px, padding 12 × 14 px, treść 14 px. Ikona kontekstowa 16–17 px po lewej, w kolorze `muted` lub marki dla pól dat.
- **Label:** nad polem, 12,5 px, waga 600, kolor `ink-2`, odstęp 7 px.
- **Focus:** globalny pierścień `outline: 2px var(--brand)` z odsunięciem 2 px; samo pole nie zmienia obramowania.
- **Disabled:** przezroczystość 0,5 przy zachowanym kształcie — czytelne, że pole istnieje, ale nie jest teraz właściwe.
- **Hint / Error:** 11,5 px pod polem, `muted` dla podpowiedzi, `danger` dla błędu.

### Navigation

- **Sidebar:** pozycje 13,5 px waga 600, padding 9 × 11 px, promień 7 px, ikona 18 px z odstępem 11 px. Stan spoczynkowy `ink-2` na przezroczystym; aktywny `brand` na `brand-tint`. Przejście 140 ms na tle i kolorze.
- **Grupy:** mikro-etykieta w monospace 10,5 px, WERSALIKI, tracking 0.13em, kolor `muted`, odstęp nad grupą 16 px. Grupa bez widocznych pozycji nie jest renderowana — użytkownik nie ma oglądać sekcji, do których nie ma dostępu.
- **Topbar:** 64 px, przyklejony, tytuł ekranu 19 px waga 700, po prawej kontrolki ikonowe 38 × 38 px z obramowaniem `border-2`.
- **Tabs:** pod linią 1 px, aktywna zakładka w kolorze marki z podkreśleniem 2 px; nieaktywne `muted` waga 600.
- **Segmented control:** tor w `surface-2` z obramowaniem, padding 3 px; aktywny segment wyskakuje na `surface` z cieniem spoczynkowym i treścią w kolorze marki.

### Coverage heatmap (signature)

Siatka kafli 40 px wysokości, promień `rounded.sm` (7 px), odstęp 6 px, pierwsza kolumna 150 px na nazwę squadu, kolumny sprintów `minmax(46px, 1fr)`. Kafle nosiły wcześniej 8 px — piąty stopień promienia, którego reguła zaokrąglonego kwadratu nie przewiduje; przy 40 px wysokości różnica jest niewidoczna, a skala zostaje czterostopniowa. Siatka jest tabelą i przedstawia się rolami `table`/`row`/`columnheader`/`rowheader`/`cell`; nagłówek kolumny niesie widoczny skrót („S13") i pełną nazwę sprintu dla czytnika ekranu, kafel bez danych mówi „brak danych", kafel wysokiego ryzyka — „wysokie ryzyko", bo pierścień jest sygnałem czysto wizualnym. Każdy kafel niesie własną wartość procentową w monospace 10,5 px w wadze 700, w kolorze `heat-N-ink` dobranym do wypełnienia. Kafle bez danych są neutralne (`surface-3`, znak „–"), nie zerowe — brak pomiaru nie jest tym samym co brak nieobecności. Kafel ≥ 50% dostaje wewnętrzny pierścień `heat-5-ring`. Pod siatką stoi legenda: gradient 170 × 11 px od `heat-1` do `heat-5` podpisany „Spokojnie / Wymaga uwagi" oraz próbka kafla wysokiego ryzyka.

### Balance counter (signature)

Etykieta 13 px, liczba w rozmiarze display, mianownik („/ 26 dni") 16 px w `muted`, obok znacznik „aktualizacja na żywo" w pigułce `brand-tint`. Pod spodem pasek 11 px wysokości, promień 7 px, tor `surface-3`, wypełniony dwoma segmentami: wykorzystane w kolorze marki, zaległe w `absence-border`. Niżej trzy liczby (pula / wykorzystano / w tym zaległe) rozdzielone pionowymi liniami 1 px, każda w monospace 22 px.

## Do's and Don'ts

### Do:

- **Do** prezentować każdą nieobecność identycznie — jeden token `absence`, jeden kształt, jeden rozmiar, niezależnie od typu, długości i osoby.
- **Do** ustawiać w IBM Plex Mono z `tabular-nums` każdą liczbę, którą użytkownik porównuje w kolumnie; Archivo zostaje dla treści.
- **Do** budować głębię tonalnie (`canvas` → `surface` → `surface-2/3`) i włoskowatą linią 1 px, zanim sięgniesz po cień.
- **Do** trzymać zieleń marki poniżej ~10% powierzchni ekranu i zawsze wiązać ją ze znaczeniem: akcja główna, stan aktywny, wykorzystana pula.
- **Do** używać zaokrąglonych kwadratów na awatary i kafle ikon (promień ≈ 26% boku) oraz inicjałów zamiast zdjęć.
- **Do** ograniczać treść do 1180 px i realizować odstępy przez `gap`, w krokach siatki 4 px.
- **Do** dawać stanom pustym pełne zdanie w `muted` („Nikt nieobecny w tym tygodniu."), a nie samą kreskę.
- **Do** odróżniać brak danych od wartości zerowej — neutralny kafel i „–" zamiast `heat-1` i „0%".

### Don't:

- **Don't** kodować typu, powodu ani „wagi" nieobecności kolorem, ikoną, obramowaniem ani kolejnością — to naruszenie art. 9 RODO i decyzji D1/D2, nie kwestia gustu.
- **Don't** cytować Excela: żadnych siatek obramowanych ze wszystkich stron, żadnych ekranów, na których każda komórka waży tyle samo. To potwierdzona anty-referencja produktu.
- **Don't** używać błękitu (`blue`) do przekazania znaczenia. To kolor wizualizacji i awatarów; sygnały niosą marka, bursztyn i czerwień.
- **Don't** wprowadzać drugiej skali sekwencyjnej ani gradientu poza heatmapą pokrycia.
- **Don't** dawać kartom w spoczynku cienia „uniesionego" — należy się wyłącznie temu, co nakłada się na treść.
- **Don't** stosować czystej czerni ani czystej bieli na tekście; atrament i płótno mają zielonkawy podkład i kontrast liczony pod WCAG 2.1 AA.
- **Don't** rysować obramowań grubszych niż 1 px (jedyny wyjątek: 1,5 px na aktywnym segmencie wyboru wymiaru dnia).
- **Don't** używać okręgów poza kropką statusu 6–7 px, ani zdjęć w miejscu awatarów.
- **Don't** dodawać emoji. Jedyne sankcjonowane to machająca dłoń w powitaniu na pulpicie.
- **Don't** animować dekoracyjnie. Ruch to wejście ekranu (fade + 8 px w górę, 200 ms) i przejścia stanów 120–160 ms; bez odbić, bez opóźnień kaskadowych.
