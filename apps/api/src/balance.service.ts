import { Injectable, NotFoundException } from '@nestjs/common';
import type { DayPart, EmploymentType } from '@prisma/client';
import type { BillingPeriod } from '@nieobecnosci/core';
import {
  balance, billingPeriodsBefore, carriedOverInto, consumesPool, dayFraction, isoDate,
  periodForYear, proratePool, resolveBillingPeriod, todayUtc, usedLeaveDays,
} from '@nieobecnosci/core';
import { PrismaService } from './prisma.service';

export const POOL_KEY_PREFIX = 'leavePool.';
export const DEFAULT_POOL_KEY = `${POOL_KEY_PREFIX}default`;
export type PoolsByType = Record<EmploymentType, number>;

// Kształty wierszy potrzebne do wyliczeń — celowo minimalne, żeby ta sama funkcja obsłużyła
// zapytanie o jedną osobę (licznik) i zapytanie wsadowe o całą jednostkę (raporty).
export interface AllowanceRow { periodYear: number; baseDays: number; overrideDays: number | null; carriedOver: number | null }
export interface AbsenceRow {
  dateFrom: Date; dateTo: Date; dayPart: DayPart;
  hourFrom: string | null; hourTo: string | null;
  type: { affectsPool: boolean };
}
export interface EmployeeCalc { startDate: Date; endDate: Date | null; employmentType: EmploymentType }

/**
 * FR-B3/B7/B9 — pula i urlop zaległy dla jednego okresu rozliczeniowego.
 *
 * Jedna implementacja dla licznika (FR-B2), walidacji zapisu (FR-A7) i raportów (FR-F2) — trzy
 * kopie tej arytmetyki oznaczałyby, że pulpit i raport potrafią pokazać pracownikowi dwie różne
 * liczby zaległych dni. Funkcja jest czysta: wszystkie wiersze wchodzą argumentem.
 *
 * `absences` to WSZYSTKIE nieobecności osoby, nie tylko z okresu docelowego — zaległe dni wynikają
 * z wykorzystania w okresach wcześniejszych.
 */
export function poolAndCarry(
  emp: EmployeeCalc,
  period: BillingPeriod,
  allowances: readonly AllowanceRow[],
  absences: readonly AbsenceRow[],
  holidays: ReadonlySet<string>,
  defaultPool: number,
): { pool: number; carriedOver: number } {
  const byYear = new Map(allowances.map((a) => [a.periodYear, a]));
  const poolFor = (p: BillingPeriod): number => {
    const a = byYear.get(p.year);
    // Korekta indywidualna jest wartością docelową, więc nie podlega proracie (jak w FR-B3).
    if (a?.overrideDays != null) return a.overrideDays;
    return proratePool(a?.baseDays ?? defaultPool, p, emp.startDate, emp.endDate);
  };
  const usedIn = (p: BillingPeriod): number => usedLeaveDays(
    absences.map((a) => ({
      dateFrom: a.dateFrom, dateTo: a.dateTo,
      affectsPool: consumesPool(emp.employmentType, a.type.affectsPool), // FR-B5 — L4 tylko na UoP
      overrides: !a.type.affectsPool, // wpis chorobowy przejmuje dzień — liczy się raz, nie dwa
      fraction: dayFraction(a.dayPart, a.hourFrom ?? undefined, a.hourTo ?? undefined),
    })),
    p,
    holidays,
  );

  const explicit = byYear.get(period.year)?.carriedOver;
  const carriedOver = explicit ?? carriedOverInto(
    billingPeriodsBefore(emp.employmentType, emp.startDate, period.year).map((p) => ({
      pool: poolFor(p), used: usedIn(p), explicit: byYear.get(p.year)?.carriedOver,
    })),
  );
  return { pool: poolFor(period), carriedOver };
}

// Wspólna logika balansu — używana przez licznik (BalanceController) i walidację wpisów
// (AbsencesService). Jedno miejsce prawdy zamiast duplikacji.
@Injectable()
export class BalanceService {
  constructor(private readonly prisma: PrismaService) {}

  // Pula domyślna per forma zatrudnienia (`leavePool.UOP` itd.); `leavePool.default` jest
  // wspólnym fallbackiem dla form, dla których administrator nie ustawił własnej wartości.
  // Jedno zapytanie na wszystkie formy — raporty liczą całą jednostkę wsadowo.
  async defaultPools(): Promise<PoolsByType> {
    const rows = await this.prisma.adminSetting.findMany({ where: { key: { startsWith: POOL_KEY_PREFIX } } });
    const byKey = new Map(rows.map((r) => [r.key, Number(r.value)]));
    const fallback = byKey.get(DEFAULT_POOL_KEY) ?? 0;
    const of = (t: EmploymentType) => byKey.get(POOL_KEY_PREFIX + t) ?? fallback;
    return { UOP: of('UOP'), B2B: of('B2B'), OUT: of('OUT') };
  }

  async defaultPool(employmentType: EmploymentType): Promise<number> {
    return (await this.defaultPools())[employmentType];
  }

  // Pula efektywna wraz z urlopem zaległym. Zaległe wymagają historii, nie tylko bieżącego okresu,
  // więc pobieramy komplet wpisów osoby — patrz `poolAndCarry`.
  async effectivePool(
    emp: { id: string; startDate: Date; endDate: Date | null; employmentType: EmploymentType },
    period: BillingPeriod,
  ): Promise<{ pool: number; carriedOver: number }> {
    const [allowances, absences, holidays, defaults] = await Promise.all([
      this.prisma.leaveAllowance.findMany({ where: { employeeId: emp.id } }),
      this.prisma.absence.findMany({ where: { employeeId: emp.id }, include: { type: true } }),
      this.holidaysFor(emp.id),
      this.defaultPools(),
    ]);
    return poolAndCarry(emp, period, allowances, absences, holidays, defaults[emp.employmentType]);
  }

  async holidaysFor(employeeId: string): Promise<Set<string>> {
    const emp = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { holidayCalendar: { include: { holidays: true } } },
    });
    return new Set((emp?.holidayCalendar?.holidays ?? []).map((h) => isoDate(h.date)));
  }

  // FR-B2 — licznik w okresie rozliczeniowym pracownika: bieżącym albo wskazanym numerem roku
  // (przełącznik na pulpicie — B2B/OUT planując grudzień, planują już następny rok budżetowy).
  async current(employeeId: string, year?: number) {
    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) throw new NotFoundException('Pracownik nie istnieje.');
    // `todayUtc()`, nie `new Date()`: o 23:30 UTC 31 grudnia w Warszawie jest już 1 stycznia,
    // a surowe „teraz" sięgnęłoby po pulę poprzedniego roku. Dwa okresy rozliczeniowe są
    // warunkiem akceptacji projektu (FR-B1), więc granica roku musi trafiać co do dnia.
    const period = year ? periodForYear(emp.employmentType, year) : resolveBillingPeriod(emp.employmentType, todayUtc());
    // Jedno pobranie wpisów obsługuje i wykorzystanie w bieżącym okresie, i łańcuch zaległych
    // z okresów wcześniejszych — dlatego bez filtra dat.
    const [allowances, absences, holidays, defaults] = await Promise.all([
      this.prisma.leaveAllowance.findMany({ where: { employeeId } }),
      this.prisma.absence.findMany({ where: { employeeId }, include: { type: true } }),
      this.holidaysFor(employeeId),
      this.defaultPools(),
    ]);
    const { pool, carriedOver } = poolAndCarry(emp, period, allowances, absences, holidays, defaults[emp.employmentType]);
    const used = usedLeaveDays(
      absences.map((a) => ({
        dateFrom: a.dateFrom, dateTo: a.dateTo,
        affectsPool: consumesPool(emp.employmentType, a.type.affectsPool), // FR-B5 — brak wpływu L4 tylko na UoP
        overrides: !a.type.affectsPool, // wpis chorobowy przejmuje dzień — liczy się raz, nie dwa
        fraction: dayFraction(a.dayPart, a.hourFrom ?? undefined, a.hourTo ?? undefined),
      })),
      period,
      holidays,
    );
    return {
      period: { from: isoDate(period.from), to: isoDate(period.to), type: period.type, year: period.year },
      ...balance(pool, carriedOver, used),
      minimumToLeave: emp.minimumToLeave, // FR-B4
    };
  }
}
