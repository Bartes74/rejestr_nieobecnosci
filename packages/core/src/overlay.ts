// FR-B5/FR-B10 — nieobecność chorobowa (typ z affectsPool=false) przykrywa wcześniej
// zaplanowaną, ale jej nie kasuje: oba wpisy zostają w bazie, a przykrycie jest projekcją
// przy odczycie i przy liczeniu. Skasowanie błędnie wpisanego L4 samo przywraca dzień do planu.
//
// Stąd jedna reguła na wszystko: dzień kalendarzowy liczy się najwyżej raz i należy do wpisu
// chorobowego. Na UoP taki dzień nie zabiera z puli, więc dni przykryte wracają; poza UoP
// zabiera (patrz `consumesPool`), więc dzień kosztuje dokładnie jeden — nie dwa.
//
// Operujemy na całych dniach: daty w bazie to `@db.Date` (północ UTC), więc dodawanie doby
// w milisekundach jest dokładne i nie łapie przesunięć czasu letniego.

import { isoDate } from './workdays.js';

const DAY = 86_400_000;
const shift = (d: Date, days: number): Date => new Date(d.getTime() + days * DAY);

export interface DateRange {
  dateFrom: Date;
  dateTo: Date;
}

/**
 * Część zakresu `span` leżąca poza zakresem `cut`.
 *
 * Zwraca kolejno: 1 zakres (brak części wspólnej), 0 (`cut` pochłania `span` w całości),
 * 1 (przycięcie od początku albo od końca) albo 2 zakresy (`cut` wypada w środku i rozcina
 * `span` na dwa kawałki). Ten ostatni przypadek jest powodem, dla którego funkcja zwraca
 * tablicę, a nie jeden opcjonalny zakres: L4 w środku dwutygodniowego urlopu zostawia urlop
 * przed chorobą i po niej.
 *
 * Służy wyłącznie do pokazywania — rekord w bazie zostaje nietknięty.
 */
export function subtractRange(span: DateRange, cut: DateRange): DateRange[] {
  if (cut.dateTo < span.dateFrom || cut.dateFrom > span.dateTo) return [span];
  const rest: DateRange[] = [];
  if (span.dateFrom < cut.dateFrom) rest.push({ dateFrom: span.dateFrom, dateTo: shift(cut.dateFrom, -1) });
  if (span.dateTo > cut.dateTo) rest.push({ dateFrom: shift(cut.dateTo, 1), dateTo: span.dateTo });
  return rest;
}

/** To samo, ale odjęte naraz od wielu zakresów — wpis może być przykryty kilkoma L4. */
export function subtractRanges(span: DateRange, cuts: readonly DateRange[]): DateRange[] {
  return cuts.reduce<DateRange[]>((rest, cut) => rest.flatMap((r) => subtractRange(r, cut)), [span]);
}

/**
 * Zakresy jednej osoby scalone w ciągłe bloki — dla widoków, które nie rozróżniają rodzaju
 * nieobecności. Bez tego dwa wpisy na ten sam dzień dają dwa paski w kalendarzu i dwa
 * wydarzenia w kanale iCal, a w kanale zespołu sam dublet zdradza, że wydarzyło się „coś
 * jeszcze" — typ nie wycieka, ale struktura tak.
 *
 * Zakresy stykające się dzień w dzień też się łączą: dla oglądającego to jedna nieobecność.
 */
export function mergeRanges(ranges: readonly DateRange[]): DateRange[] {
  const sorted = [...ranges].sort((a, b) => a.dateFrom.getTime() - b.dateFrom.getTime());
  const out: DateRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.dateFrom.getTime() <= last.dateTo.getTime() + DAY) {
      if (r.dateTo > last.dateTo) last.dateTo = r.dateTo;
    } else {
      out.push({ dateFrom: r.dateFrom, dateTo: r.dateTo });
    }
  }
  return out;
}

export interface DaySpan extends DateRange {
  /** Wpis chorobowy — przejmuje dzień na własność. */
  overrides: boolean;
  /** Czy dzień tego wpisu ma się liczyć (pula: `consumesPool`, capacity: `affectsCapacity`). */
  counts: boolean;
  /** Dla niepełnych dni; domyślnie 1. */
  fraction?: number;
}

/**
 * Dni robocze JEDNEJ osoby w okresie, każdy policzony najwyżej raz.
 *
 * Dzień pokryty całodniowym wpisem `overrides` należy wyłącznie do niego. Ograniczenie do
 * całych dni jest celowe: pół dnia choroby nie przejmuje całego dnia urlopu — wtedy ułamki
 * się sumują, z zaciskiem do jednego dnia, bo jednego dnia nie da się być nieobecnym półtora
 * raza.
 */
export function countOverlaidDays(
  spans: readonly DaySpan[],
  period: { from: Date; to: Date },
  holidays: ReadonlySet<string> = new Set(),
): number {
  const byDay = new Map<string, DaySpan[]>();
  for (const s of spans) {
    const from = s.dateFrom > period.from ? s.dateFrom : period.from;
    const to = s.dateTo < period.to ? s.dateTo : period.to;
    let t = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
    const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
    while (t <= end) {
      const cur = new Date(t);
      const day = cur.getUTCDay(); // 0 = niedziela, 6 = sobota
      const iso = isoDate(cur);
      if (day !== 0 && day !== 6 && !holidays.has(iso)) {
        const at = byDay.get(iso);
        if (at) at.push(s);
        else byDay.set(iso, [s]);
      }
      t += DAY;
    }
  }

  let total = 0;
  for (const covering of byDay.values()) {
    const owner = covering.find((s) => s.overrides && (s.fraction ?? 1) === 1);
    if (owner) {
      if (owner.counts) total += 1;
      continue;
    }
    const sum = covering.reduce((a, s) => a + (s.counts ? s.fraction ?? 1 : 0), 0);
    total += Math.min(1, sum);
  }
  return total;
}
