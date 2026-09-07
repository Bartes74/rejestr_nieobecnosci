// FR-B1 / D5 (warunek akceptacji) — odrębne okresy rozliczeniowe:
//   UoP      → rok kalendarzowy (sty–gru)
//   B2B/OUT  → rok budżetowy: przesunięty o 1 miesiąc wstecz (gru poprz. roku – lis bieżącego)
// Wszystkie daty w UTC, by uniknąć dryfu stref czasowych.

export type EmploymentType = 'UOP' | 'B2B' | 'OUT';

export interface BillingPeriod {
  from: Date;
  to: Date;
  type: 'CALENDAR' | 'BUDGET';
  year: number; // rok kalendarzowy (UoP) lub budżetowy (B2B/OUT)
}

const utc = (y: number, m: number, d: number): Date => new Date(Date.UTC(y, m, d));

export function resolveBillingPeriod(employmentType: EmploymentType, date: Date): BillingPeriod {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0 = styczeń … 11 = grudzień

  if (employmentType === 'UOP') {
    return { from: utc(y, 0, 1), to: utc(y, 11, 31), type: 'CALENDAR', year: y };
  }

  // Grudzień należy już do KOLEJNEGO roku budżetowego (gru 2025 → rok budżetowy 2026).
  const budgetYear = m === 11 ? y + 1 : y;
  return { from: utc(budgetYear - 1, 11, 1), to: utc(budgetYear, 10, 30), type: 'BUDGET', year: budgetYear };
}

/**
 * Okres rozliczeniowy o danym numerze roku. 1 stycznia należy do roku `year` w obu wariantach
 * (kalendarzowy: cały rok; budżetowy: grudzień year−1 – listopad year), więc nie trzeba powtarzać
 * reguły przesunięcia. Używane przez przełącznik okresu na pulpicie (`?year=`).
 */
export function periodForYear(employmentType: EmploymentType, year: number): BillingPeriod {
  return resolveBillingPeriod(employmentType, utc(year, 0, 1));
}

/**
 * FR-B7 — okresy rozliczeniowe od zatrudnienia do (bez) okresu docelowego, rosnąco.
 *
 * Zaległy urlop nie bierze się z jednego przełomu, tylko z przejścia przez wszystkie wcześniejsze
 * okresy: żeby wiedzieć, ile dni wchodzi do roku 2028, trzeba przejść 2026 i 2027. Osoba zatrudniona
 * w okresie docelowym lub później nie ma z czego rolować — wtedy lista jest pusta.
 */
export function billingPeriodsBefore(employmentType: EmploymentType, startDate: Date, targetYear: number): BillingPeriod[] {
  const out: BillingPeriod[] = [];
  let p = resolveBillingPeriod(employmentType, startDate);
  while (p.year < targetYear) {
    out.push(p);
    // Pierwszy dzień po okresie należy już do następnego — bez osobnej arytmetyki na miesiącach,
    // która dla roku budżetowego (gru–lis) musiałaby powtarzać regułę przesunięcia.
    p = resolveBillingPeriod(employmentType, new Date(p.to.getTime() + 86_400_000));
  }
  return out;
}
