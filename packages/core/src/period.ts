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
