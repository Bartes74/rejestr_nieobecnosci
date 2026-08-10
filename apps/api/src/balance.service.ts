import { Injectable, NotFoundException } from '@nestjs/common';
import type { EmploymentType } from '@prisma/client';
import { balance, consumesPool, dayFraction, isoDate, proratePool, resolveBillingPeriod, todayUtc, usedLeaveDays } from '@nieobecnosci/core';
import { PrismaService } from './prisma.service';

export const POOL_KEY_PREFIX = 'leavePool.';
export const DEFAULT_POOL_KEY = `${POOL_KEY_PREFIX}default`;
export type PoolsByType = Record<EmploymentType, number>;

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

  // Pula efektywna: korekta indywidualna ma priorytet (bez proraty); baza/domyślna jest
  // naliczana proporcjonalnie do okresu zatrudnienia (FR-B9).
  async effectivePool(
    emp: { id: string; startDate: Date; endDate: Date | null; employmentType: EmploymentType },
    period: { from: Date; to: Date; year: number },
  ): Promise<{ pool: number; carriedOver: number }> {
    const allowance = await this.prisma.leaveAllowance.findUnique({
      where: { employeeId_periodYear: { employeeId: emp.id, periodYear: period.year } },
    });
    const carriedOver = allowance?.carriedOver ?? 0;
    if (allowance?.overrideDays != null) return { pool: allowance.overrideDays, carriedOver };
    const base = allowance?.baseDays ?? (await this.defaultPool(emp.employmentType));
    return { pool: proratePool(base, { from: period.from, to: period.to }, emp.startDate, emp.endDate), carriedOver };
  }

  async holidaysFor(employeeId: string): Promise<Set<string>> {
    const emp = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { holidayCalendar: { include: { holidays: true } } },
    });
    return new Set((emp?.holidayCalendar?.holidays ?? []).map((h) => isoDate(h.date)));
  }

  // FR-B2 — licznik w bieżącym okresie rozliczeniowym pracownika.
  async current(employeeId: string) {
    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) throw new NotFoundException('Pracownik nie istnieje.');
    // `todayUtc()`, nie `new Date()`: o 23:30 UTC 31 grudnia w Warszawie jest już 1 stycznia,
    // a surowe „teraz" sięgnęłoby po pulę poprzedniego roku. Dwa okresy rozliczeniowe są
    // warunkiem akceptacji projektu (FR-B1), więc granica roku musi trafiać co do dnia.
    const period = resolveBillingPeriod(emp.employmentType, todayUtc());
    const { pool, carriedOver } = await this.effectivePool(emp, period);
    const holidays = await this.holidaysFor(employeeId);
    const absences = await this.prisma.absence.findMany({
      where: { employeeId, dateFrom: { lte: period.to }, dateTo: { gte: period.from } },
      include: { type: true },
    });
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
