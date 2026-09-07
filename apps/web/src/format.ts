/**
 * Zapis dat w interfejsie. Jedno miejsce, bo siedem kopii `slice(8, 10)` rozjechało się
 * w trzy różne formaty w jednym produkcie: „3.08", „03.08.2026" i surowe ISO „2026-08-03"
 * w Zespole i Konfiguracji. PRODUCT.md wymaga zapisu polskiego, a nie każdego z osobna.
 *
 * Wejściem jest ciąg z serwera, zawsze w zapisie `YYYY-MM-DD` — daty kalendarzowe zamienia
 * na tekst granica API (`apps/api/src/serialize.ts`), więc front nie ma już czego obcinać.
 * Kroimy tekst zamiast budować `Date`, bo `new Date('2026-08-03')` czyta się jako UTC
 * i w strefie ujemnej cofa dzień — data nieobecności to etykieta kalendarzowa, nie moment.
 */

// „Dziś" liczy pakiet współdzielony, w strefie organizacji — ta sama odpowiedź po obu stronach.
// Reeksport, żeby ekrany miały jedno miejsce, z którego biorą wszystko, co dotyczy dat.
import { todayIso, todayUtc } from '@nieobecnosci/core/today';
import { mergeRanges } from '@nieobecnosci/core/overlay';
import { resolveBillingPeriod, type EmploymentType } from '@nieobecnosci/core/period';
export { todayIso, ORG_TIMEZONE } from '@nieobecnosci/core/today';

// Mianownik, bo to etykieta okresu albo nagłówek miesiąca, a nie data — „SIERPNIA 2026" czyta się
// jak urwane zdanie. Jedna lista dla mini-kalendarza wpisu i etykiet okresu rozliczeniowego.
export const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

/** Forma zatrudnienia tak, jak nazywa ją administrator w Konfiguracji i Pracownikach. */
export const EMPLOYMENT_LABEL: Record<string, string> = { UOP: 'UoP', B2B: 'B2B', OUT: 'OUT' };

export interface PeriodLike { from: string; to: string; type: string; year: number }

/**
 * Etykieta okresu rozliczeniowego. Sam rok („Rok budżetowy 2026") nie mówił, że chodzi o grudzień
 * 2025 – listopad 2026, więc zleceniodawca planujący grudzień nie rozumiał, dlaczego pula się nie
 * zmienia (feedback002). `short` dla miejsc, gdzie zakres miesięcy by nie zmieścił się w wierszu.
 */
export function periodLabel(p: PeriodLike, opts?: { short?: boolean }): string {
  const kind = p.type === 'CALENDAR' ? 'rok kalendarzowy' : 'rok budżetowy';
  if (opts?.short) return `${kind} ${p.year}`;
  const month = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1];
  const fy = p.from.slice(0, 4), ty = p.to.slice(0, 4);
  const range = fy === ty ? `${month(p.from)} – ${month(p.to)} ${ty}` : `${month(p.from)} ${fy} – ${month(p.to)} ${ty}`;
  return `${kind}: ${range}`;
}

/** Bieżący okres rozliczeniowy osoby o danej formie — liczony tak samo jak na serwerze, w strefie organizacji. */
export function currentPeriod(employmentType: string): PeriodLike {
  const p = resolveBillingPeriod(employmentType as EmploymentType, todayUtc());
  return { from: p.from.toISOString().slice(0, 10), to: p.to.toISOString().slice(0, 10), type: p.type, year: p.year };
}

/** `3.08` — dzień i miesiąc. Dla zakresów w obrębie znanego roku (kalendarz, pigułki). */
export const dayMonth = (iso: string) => `${Number(iso.slice(8, 10))}.${iso.slice(5, 7)}`;

/** `3.08.2026` — pełna data. Wszędzie, gdzie rok nie wynika z kontekstu. */
export const fullDate = (iso: string) => `${Number(iso.slice(8, 10))}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/**
 * Zakres dat. Jednodniowy zwija się do jednej daty — „3.08 – 3.08" to szum, nie precyzja.
 * `long` decyduje, czy rok jest widoczny; półpauza wg konwencji zapisu z PRODUCT.md.
 */
export function dateRange(from: string, to: string, opts?: { long?: boolean }): string {
  const fmt = opts?.long ? fullDate : dayMonth;
  return from === to ? fmt(from) : `${fmt(from)}–${fmt(to)}`;
}

/** Dzień miesiąca bez wiodącego zera, do kafli z datą. */
export const dayOfMonth = (iso: string) => iso.slice(8, 10);

/**
 * Przesunięcie o dni na etykiecie kalendarzowej. Liczone na północy UTC, więc czas letni
 * niczego nie przesuwa — dodanie 7 dni zawsze daje ten sam dzień tygodnia, także w weekend
 * zmiany czasu, kiedy doba ma 23 albo 25 godzin.
 */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Granice tygodnia (poniedziałek–niedziela) zawierającego podany dzień; domyślnie bieżący,
 * liczony w strefie organizacji. Pulpit i kalendarz miały własne kopie tej funkcji, obie
 * zakotwiczone w zegarze przeglądarki.
 */
export function weekBounds(anchor: string = todayIso()): [string, string] {
  const dow = (new Date(`${anchor}T00:00:00.000Z`).getUTCDay() + 6) % 7; // poniedziałek = 0
  const monday = addDays(anchor, -dow);
  return [monday, addDays(monday, 6)];
}

/** Rok i miesiąc (0–11) dnia bieżącego w strefie organizacji — punkt startowy kalendarza. */
export function currentYearMonth(): { y: number; m: number } {
  const t = todayIso();
  return { y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) - 1 };
}

/**
 * Zakresy jednej osoby scalone w ciągłe bloki. Wpisy mogą się nakładać (L4 wchodzi na
 * zaplanowaną nieobecność i oba rekordy zostają), a widok, który nie rozróżnia rodzaju,
 * pokazałby wtedy dwa paski na tych samych dniach zamiast jednej nieobecności.
 *
 * Arytmetyka idzie z pakietu współdzielonego — to ta sama funkcja, którą serwer scala kanał
 * iCal, więc siatka i subskrypcja nie mogą się rozjechać. Konwersja przez `T00:00:00Z` jest
 * jawnie w UTC, zgodnie z regułą tego modułu: data nieobecności to etykieta, nie moment.
 */
export function mergeIsoRanges(ranges: readonly { from: string; to: string }[]): { from: string; to: string }[] {
  const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  return mergeRanges(ranges.map((r) => ({ dateFrom: utc(r.from), dateTo: utc(r.to) })))
    .map((r) => ({ from: r.dateFrom.toISOString().slice(0, 10), to: r.dateTo.toISOString().slice(0, 10) }));
}
