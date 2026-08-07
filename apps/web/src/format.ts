/**
 * Zapis dat w interfejsie. Jedno miejsce, bo siedem kopii `slice(8, 10)` rozjechało się
 * w trzy różne formaty w jednym produkcie: „3.08", „03.08.2026" i surowe ISO „2026-08-03"
 * w Zespole i Konfiguracji. PRODUCT.md wymaga zapisu polskiego, a nie każdego z osobna.
 *
 * Wejściem jest zawsze ciąg z serwera — ISO `YYYY-MM-DD` albo pełny znacznik czasu.
 * Kroimy tekst zamiast budować `Date`, bo `new Date('2026-08-03')` czyta się jako UTC
 * i w strefie ujemnej cofa dzień — data nieobecności to etykieta kalendarzowa, nie moment.
 */

const ymd = (iso: string) => iso.slice(0, 10);

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
  const [f, t] = [ymd(from), ymd(to)];
  return f === t ? fmt(f) : `${fmt(f)}–${fmt(t)}`;
}

/** Dzień miesiąca bez wiodącego zera, do kafli z datą. */
export const dayOfMonth = (iso: string) => iso.slice(8, 10);
