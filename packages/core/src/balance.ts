// FR-B2 — licznik balansu: pula + zaległe − wykorzystano = pozostało.
// FR-B5 — L4 (affectsPool=false) NIE obniża puli urlopu — ale wyłącznie na UoP (patrz `consumesPool`).
// FR-B7 — urlop zaległy zawsze powiększa dostępną pulę (nigdy nie przepada).

import type { EmploymentType } from './period.js';
import { countOverlaidDays } from './overlay.js';

/**
 * Czy dzień takiej nieobecności zabiera dzień z puli danej osoby.
 *
 * FR-B5 mówi o UoP i tylko o UoP: tam L4 jest świadczeniem chorobowym, więc zaplanowany
 * urlop musi dać się przełożyć i dni wracają do puli. Poza UoP nieobecność bez puli nie
 * istnieje — dzień choroby zjada ten sam budżet dni co urlop, więc nic nie wraca.
 *
 * Reguła stoi na fladze `affectsPool`, nigdy na nazwie typu (D1), więc obejmie też każdy
 * przyszły typ bez puli dodany przez administratora. Warunek jest po stronie „nie UoP", nie
 * po liście form, żeby kolejna forma zatrudnienia domyślnie nie zwracała dni.
 */
export const consumesPool = (employmentType: EmploymentType, affectsPool: boolean): boolean =>
  affectsPool || employmentType !== 'UOP';

/**
 * Minimalna roczna pula dla form rozliczanych w roku budżetowym — reguła zamawiającego
 * („B2B i OUT: min 20 dni, możliwość wybierania więcej"). Dotyczy wartości, którą ustawia
 * administrator (wspólnej, per forma i korekty indywidualnej), nie puli po proracie: osoba
 * zatrudniona w połowie roku ma jej proporcjonalnie mniej i to jest poprawne. UoP bez minimum —
 * tam wymiar wynika z Kodeksu pracy i administrator sam odpowiada za 20/26.
 */
export const MIN_POOL_DAYS: Readonly<Partial<Record<EmploymentType, number>>> = { B2B: 20, OUT: 20 };
export const minPoolFor = (employmentType: EmploymentType): number => MIN_POOL_DAYS[employmentType] ?? 0;

export interface AbsenceSpan {
  dateFrom: Date;
  dateTo: Date;
  affectsPool: boolean; // czy dzień tego wpisu zabiera z puli — już po `consumesPool`
  overrides?: boolean; // wpis chorobowy (typ z affectsPool=false) — przejmuje dzień
  fraction?: number; // dla niepełnych dni; domyślnie 1
}

export interface PeriodRange {
  from: Date;
  to: Date;
}

/**
 * Dni urlopowe wykorzystane w okresie, przycięte do okresu.
 *
 * Wpisy jednej osoby mogą się nakładać (L4 na zaplanowanej nieobecności), więc liczenie idzie
 * po dniach kalendarzowych, nie po wpisach — inaczej ten sam dzień policzyłby się dwa razy
 * poza UoP, a na UoP nie oddałby się do puli.
 */
export function usedLeaveDays(
  absences: readonly AbsenceSpan[],
  period: PeriodRange,
  holidays: ReadonlySet<string> = new Set(),
): number {
  return countOverlaidDays(
    absences.map((a) => ({
      dateFrom: a.dateFrom, dateTo: a.dateTo,
      overrides: a.overrides ?? false,
      counts: a.affectsPool,
      fraction: a.fraction,
    })),
    period,
    holidays,
  );
}

export interface Balance {
  pool: number;
  carriedOver: number;
  used: number;
  remaining: number;
}

export function balance(poolDays: number, carriedOver: number, usedDays: number): Balance {
  return { pool: poolDays, carriedOver, used: usedDays, remaining: poolDays + carriedOver - usedDays };
}

export interface PeriodOutcome {
  pool: number;
  used: number;
  /** Ręczna korekta administratora dla tego okresu — `null`/brak = wyliczane automatycznie. */
  explicit?: number | null;
}

/**
 * FR-B7 — ile dni zaległych wchodzi do okresu docelowego.
 *
 * Urlop nie przepada, więc niewykorzystana część puli przechodzi do następnego okresu, i tak dalej
 * przez cały łańcuch od zatrudnienia. Bez tego 1 stycznia (UoP) i 1 grudnia (B2B/OUT) saldo zaległych
 * spadałoby do zera, bo dla nowego okresu nie ma jeszcze żadnego wiersza w bazie.
 *
 * Wartość ustawiona ręcznie przez administratora wygrywa nad wyliczoną i staje się nową podstawą
 * łańcucha — inaczej korekta znikałaby przy najbliższym przełomie okresu.
 *
 * Ujemne saldo nie przechodzi dalej: przekroczenie puli jest blokowane przy zapisie, a gdyby powstało
 * korektą puli w dół, dług nie ma się rolować na kolejny rok jako ukryta kara.
 *
 * `previous` to okresy od zatrudnienia do poprzedzającego docelowy, rosnąco (patrz `billingPeriodsBefore`).
 */
export function carriedOverInto(previous: readonly PeriodOutcome[]): number {
  let carried = 0;
  for (const p of previous) {
    const into = p.explicit ?? carried;
    carried = Math.max(0, p.pool + into - p.used);
  }
  return carried;
}

// FR-B9 — pula proporcjonalna do części okresu, w której osoba jest zatrudniona/współpracuje.
// Zaokrąglenie do 0,5 dnia. Zwraca 0, jeśli zatrudnienie nie pokrywa się z okresem.
export function proratePool(pool: number, period: PeriodRange, startDate: Date, endDate?: Date | null): number {
  const DAY = 86_400_000;
  const ps = period.from.getTime();
  const pe = period.to.getTime();
  const es = Math.max(ps, startDate.getTime());
  const ee = Math.min(pe, (endDate ?? period.to).getTime());
  if (ee < es) return 0;
  const total = (pe - ps) / DAY + 1;
  const employed = (ee - es) / DAY + 1;
  return Math.round(((pool * employed) / total) * 2) / 2;
}
