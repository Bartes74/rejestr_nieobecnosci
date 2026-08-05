import { Injectable, NotFoundException } from '@nestjs/common';
import { balance, dayFraction, isoDate, proratePool, resolveBillingPeriod, usedLeaveDays } from '@nieobecnosci/core';
import { PrismaService } from './prisma.service';

const DEFAULT_POOL_KEY = 'leavePool.default';

// Wspólna logika balansu — używana przez licznik (BalanceController) i walidację wpisów
// (AbsencesService). Jedno miejsce prawdy zamiast duplikacji.
@Injectable()
export class BalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async defaultPool(): Promise<number> {
    const s = await this.prisma.adminSetting.findUnique({ where: { key: DEFAULT_POOL_KEY } });
    return s ? Number(s.value) : 0;
  }

  // Pula efektywna: korekta indywidualna ma priorytet (bez proraty); baza/domyślna jest
  // naliczana proporcjonalnie do okresu zatrudnienia (FR-B9).
  async effectivePool(
    emp: { id: string; startDate: Date; endDate: Date | null },
    period: { from: Date; to: Date; year: number },
  ): Promise<{ pool: number; carriedOver: number }> {
    const allowance = await this.prisma.leaveAllowance.findUnique({
      where: { employeeId_periodYear: { employeeId: emp.id, periodYear: period.year } },
    });
    const carriedOver = allowance?.carriedOver ?? 0;
    if (allowance?.overrideDays != null) return { pool: allowance.overrideDays, carriedOver };
    const base = allowance?.baseDays ?? (await this.defaultPool());
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
    const period = resolveBillingPeriod(emp.employmentType, new Date());
    const { pool, carriedOver } = await this.effectivePool(emp, period);
    const holidays = await this.holidaysFor(employeeId);
    const absences = await this.prisma.absence.findMany({
      where: { employeeId, dateFrom: { lte: period.to }, dateTo: { gte: period.from } },
      include: { type: true },
    });
    const used = usedLeaveDays(
      absences.map((a) => ({
        dateFrom: a.dateFrom, dateTo: a.dateTo, affectsPool: a.type.affectsPool,
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
