# Wniosek o potwierdzenie zawężenia NFR-6 i NFR-7

**Status: projekt do wysłania.** Dokument przygotował zespół wykonawczy 10.08.2026. Nie został
nikomu wysłany — decyzję o wysłaniu i formę (mail, punkt na komitecie, aneks) podejmuje prowadzący
projekt.

**Do:** Credit Agricole — właściciel biznesowy projektu „Nieobecności", z kopią do IOD
**Dotyczy:** dokument „Wymagania funkcjonalne i niefunkcjonalne v2.0" z 22.06.2026, punkty NFR-6 i NFR-7

---

## Po co ten wniosek

NFR-6 i NFR-7 są wymaganiami kontraktowymi. W trakcie prac zapadły decyzje, które zawężają ich
zakres. Zespół nie chce ich przyjąć po cichu: dopóki nie ma potwierdzenia po Państwa stronie, są to
propozycje wykonawcy, nie stan uzgodniony. Prosimy o rozstrzygnięcie dwóch punktów.

---

## Punkt 1 — NFR-6: rezygnacja z interfejsu mobilnego

**Brzmienie wymagania:** „Interfejs responsywny dla desktopu i urządzeń mobilnych. Kluczowe akcje
dostępne na małym ekranie."

**Stan faktyczny:** aplikacja jest przeznaczona na stację roboczą. Powłoka ma stały panel boczny
250 px; poniżej ok. 1000 px szerokości treść przewija się w poziomie, przy 400 px przestaje być
użyteczna.

**Dlaczego tak zdecydowano:** aplikacja pracuje w sieci wewnętrznej instytucji, na stacjach roboczych
w godzinach pracy. Doprowadzenie jedenastu ekranów — w tym kalendarza zespołu, heatmapy pokrycia
i raportów z drążeniem hierarchii — do użyteczności na telefonie to praca porównywalna z ich
ponownym zaprojektowaniem, przy braku sygnału, że ktokolwiek chce z nich korzystać z telefonu.

**Co pozostaje w mocy:** wymaganie „maksymalnie 3 kliknięcia od zalogowania do zapisu wpisu i do
podglądu raportu", pochodzące z tego samego NFR-6, jest spełnione i nie podlega zawężeniu.

**Wariant pośredni do rozważenia (rekomendacja zespołu):** udostępnić na telefonie **dwa ekrany** —
pulpit i formularz wpisu nieobecności. Pokrywa to realny scenariusz mobilny („zachorowałem, wpisuję
z domu") kosztem ułamka pracy nad pełną responsywnością. Pozostałe dziewięć ekranów to narzędzia
planistyczne i raportowe, używane przy biurku.

**Prosimy o wskazanie jednego z trzech:**

1. akceptacja zawężenia — aplikacja pozostaje desktop-only,
2. wariant pośredni — pulpit i wpis dostępne na telefonie,
3. brak zgody — NFR-6 realizowane w pełnym brzmieniu (wymaga osobnej wyceny i terminu).

---

## Punkt 2 — NFR-7: wyłączenie kryterium WCAG 2.1 AA „1.4.10 Reflow"

**Brzmienie wymagania:** „Zgodność z WCAG 2.1 na poziomie AA (kontrast, obsługa z klawiatury,
czytniki ekranu)."

**Wniosek dotyczy jednego kryterium sukcesu — 1.4.10 Reflow.** Wymaga ono, by treść dawała się
przedstawić w kolumnie o szerokości 320 px bez przewijania w dwóch osiach. Jest to bezpośrednia
konsekwencja punktu 1: domknięcie 1.4.10 oznacza przelewanie treści na wszystkich jedenastu
ekranach, czyli cofnięcie decyzji o desktop-only. Jeśli zapadnie decyzja o pełnym NFR-6, ten punkt
staje się bezprzedmiotowy.

**Wszystkie pozostałe kryteria AA obowiązują bez zmian** — w tym 1.4.3 Contrast, 1.4.11 Non-text
Contrast, 1.3.1 Info and Relationships, 2.1.1 Keyboard, 2.4.1 Bypass Blocks, 2.4.7 Focus Visible
i 4.1.3 Status Messages.

**Korekta wobec wcześniejszej propozycji:** w decyzji z 07.08.2026 zespół proponował wyłączyć także
**1.4.4 Resize Text**. Po sprawdzeniu 10.08.2026 wycofujemy tę część wniosku — przy powiększeniu
200% treść zawija się prawidłowo, żaden kontener nie przycina tekstu i żadna kontrolka nie znika.
**1.4.4 wraca do zakresu i jest spełnione.**

**Stan zgodności na 10.08.2026:** audyt automatyczny narzędziem axe-core 4.13 objął 12 ekranów
(ekran logowania i 11 tras aplikacji) w regułach `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`
i wykazał **0 naruszeń**. Dwa naruszenia znalezione w trakcie audytu (przewijane siatki kalendarza
i heatmapy niedostępne z klawiatury, kryterium 2.1.1) zostały naprawione tego samego dnia.

Zwracamy uwagę, że **audyt automatyczny pokrywa część kryteriów WCAG**. Nie zastępuje testu
z czytnikiem ekranu ani oceny eksperckiej. Jeśli oczekują Państwo formalnej deklaracji zgodności,
rekomendujemy zlecenie audytu eksperckiego przed wdrożeniem produkcyjnym.

**Prosimy o wskazanie jednego z dwóch:**

1. akceptacja wyłączenia 1.4.10 Reflow przy utrzymaniu pozostałych kryteriów AA,
2. brak zgody — 1.4.10 realizowane, co pociąga za sobą pełne NFR-6 (osobna wycena i termin).

---

## Termin

Prosimy o rozstrzygnięcie **przed wdrożeniem produkcyjnym**. Do tego czasu dokumentacja projektu
opisuje oba punkty jako propozycje wykonawcy, a nie jako uzgodniony zakres.

## Materiały uzupełniające

- `PRODUCT.md`, sekcje „Capabilities and Constraints" oraz „Accessibility & Inclusion" — pełne
  uzasadnienie obu decyzji.
- `README.md`, sekcja „Dostępność cyfrowa" — metoda audytu i sposób jego powtórzenia.
- `Backlog - aplikacja nieobecnosci.xlsx`, kolumna „Stan wdrożenia" — pozycje US-N6 i US-N7.
