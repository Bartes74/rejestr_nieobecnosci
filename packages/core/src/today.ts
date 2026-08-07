/**
 * „Dziś" w strefie organizacji.
 *
 * W tym systemie data nieobecności jest **etykietą kalendarzową, nie momentem** — 8 sierpnia
 * to 8 sierpnia niezależnie od tego, gdzie stoi laptop. Cała warstwa trwałości trzyma to
 * konsekwentnie: daty zapisywane są jako północ UTC (`Date.UTC`) i odczytywane getterami UTC.
 *
 * Jest jednak dokładnie jedno miejsce, w którym trzeba znać strefę: zamiana „teraz" na „dziś".
 * Robił to `new Date().toISOString().slice(0, 10)`, czyli data w UTC — a Polska ma UTC+1 zimą
 * i UTC+2 latem. Skutki były realne:
 *
 *  - między północą a 1:00 (zimą) lub 2:00 (latem) formularz nowej nieobecności podpowiadał
 *    dzień wczorajszy, a historia klasyfikowała dzisiejszy wpis jako „zrealizowany";
 *  - w nocy 1 stycznia `resolveBillingPeriod` widział jeszcze grudzień i sięgał po pulę
 *    poprzedniego roku — a dwa okresy rozliczeniowe są warunkiem akceptacji projektu (FR-B1).
 *
 * Strefa jest zaszyta, nie konfigurowalna: dzień roboczy departamentu wyznacza siedziba
 * organizacji, a nie zegar współpracownika B2B z innej lokalizacji. Ten sam wynik ma dostać
 * serwer i przeglądarka, więc funkcja mieszka w pakiecie współdzielonym.
 */

export const ORG_TIMEZONE = 'Europe/Warsaw';

// `sv-SE` formatuje datę jako `YYYY-MM-DD`, czyli dokładnie w zapisie, którego używa reszta
// systemu. To jedyny powód wyboru tego języka — nie ma tu nic szwedzkiego poza kolejnością pól.
const ymd = new Intl.DateTimeFormat('sv-SE', {
  timeZone: ORG_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Dzisiejsza data w strefie organizacji, w zapisie `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  return ymd.format(now);
}

/**
 * Dzisiejsza data w strefie organizacji, jako północ UTC — w postaci, w której reszta systemu
 * przechowuje i porównuje daty. Do przekazania funkcjom oczekującym `Date` (np. `resolveBillingPeriod`).
 */
export function todayUtc(now: Date = new Date()): Date {
  return new Date(`${todayIso(now)}T00:00:00.000Z`);
}
