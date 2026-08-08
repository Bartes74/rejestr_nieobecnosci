// FR-B2 — licznik balansu: pula + zaległe − wykorzystano = pozostało.
// FR-B5 — L4 (affectsPool=false) NIE obniża puli urlopu — ale wyłącznie na UoP (patrz `consumesPool`).
// FR-B7 — urlop zaległy zawsze powiększa dostępną pulę (nigdy nie przepada).

import type { EmploymentType } from './period.js';
import { countWorkingDays } from './workdays.js';

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

export interface AbsenceSpan {
  dateFrom: Date;
  dateTo: Date;
  affectsPool: boolean;
  fraction?: number; // dla niepełnych dni; domyślnie 1
}

export interface PeriodRange {
  from: Date;
  to: Date;
}

/** Dni urlopowe wykorzystane w okresie — tylko typy obniżające pulę; przycięte do okresu. */
export function usedLeaveDays(
  absences: readonly AbsenceSpan[],
  period: PeriodRange,
  holidays: ReadonlySet<string> = new Set(),
): number {
  let used = 0;
  for (const a of absences) {
    if (!a.affectsPool) continue; // L4 i inne niepomniejszające puli
    const from = a.dateFrom > period.from ? a.dateFrom : period.from;
    const to = a.dateTo < period.to ? a.dateTo : period.to;
    used += countWorkingDays(from, to, holidays) * (a.fraction ?? 1);
  }
  return used;
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
