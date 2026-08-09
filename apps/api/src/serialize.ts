import { isoDate } from '@nieobecnosci/core';

/**
 * Daty kalendarzowe na granicy API.
 *
 * Kolumny `@db.Date` to etykiety kalendarzowe, nie momenty — w bazie i w warstwie domenowej
 * siedzą jako `Date` (północ UTC), bo tego wymaga arytmetyka dni roboczych. Na zewnątrz mają
 * wychodzić w tym samym zapisie, w jakim przychodzą: `YYYY-MM-DD`.
 *
 * Powód jest praktyczny. `/calendar` przepuszczał daty przez `isoDate`, a `/absences`,
 * `/sprints` i `/holidays` oddawały pełne znaczniki czasu (`2026-08-10T00:00:00.000Z`).
 * Ten sam dzień miał więc dwa zapisy zależnie od endpointu, a front łatał to obcięciem
 * `slice(0, 10)` w kilkunastu miejscach. Obejście milczy, kiedy przestaje wystarczać:
 * doklejenie `T00:00:00Z` do wartości już zakończonej strefą daje `Invalid Date`, a pętla
 * po dniach wykonuje się zero razy — na zrzucie ekranu wygląda to jak pusty kalendarz,
 * nie jak błąd.
 *
 * Zamiana zostaje na granicy: serwis liczy na `Date`, klient dostaje tekst.
 */

/** Wiersz z zakresem dat (nieobecność, sprint) w zapisie `YYYY-MM-DD`. */
export const isoRange = <T extends { dateFrom: Date; dateTo: Date }>(
  row: T,
): Omit<T, 'dateFrom' | 'dateTo'> & { dateFrom: string; dateTo: string } =>
  ({ ...row, dateFrom: isoDate(row.dateFrom), dateTo: isoDate(row.dateTo) });

/** Wiersz z pojedynczą datą kalendarzową (dzień wolny) w zapisie `YYYY-MM-DD`. */
export const isoDay = <T extends { date: Date }>(
  row: T,
): Omit<T, 'date'> & { date: string } =>
  ({ ...row, date: isoDate(row.date) });
