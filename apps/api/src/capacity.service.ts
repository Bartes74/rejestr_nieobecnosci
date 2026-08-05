import { Injectable, NotFoundException } from '@nestjs/common';
import { countWorkingDays, dayFraction, isoDate } from '@nieobecnosci/core';
import type { DayPart } from '@prisma/client';
import { PrismaService } from './prisma.service';

const maxDate = (...d: Date[]) => d.reduce((a, b) => (a > b ? a : b));
const minDate = (...d: Date[]) => d.reduce((a, b) => (a < b ? a : b));
const fractionOf = (a: { dayPart: DayPart; hourFrom: string | null; hourTo: string | null }) =>
  dayFraction(a.dayPart, a.hourFrom ?? undefined, a.hourTo ?? undefined);

export interface KeyRoleCollision {
  dateFrom: string;
  dateTo: string;
  employees: [string, string];
}

@Injectable()
export class CapacityService {
  constructor(private readonly prisma: PrismaService) {}

  // FR-D2 — capacity squadu w sprincie + FR-D3 — kolizje kluczowych ról.
  // FR-G7 — dni robocze liczone wg kalendarza świąt właściwego dla każdej osoby.
  async forSprint(sprintId: string, unitId: string) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) throw new NotFoundException('Sprint nie istnieje.');
    const unit = await this.prisma.orgUnit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Jednostka nie istnieje.');

    const members = await this.prisma.orgUnitMembership.findMany({
      where: { orgUnitId: unitId },
      include: { employee: { include: { holidayCalendar: { include: { holidays: true } } } } },
    });

    // kalendarz świąt per osoba (FR-G7); brak kalendarza → tylko weekendy
    const holidaysByEmp = new Map<string, Set<string>>();
    for (const m of members) {
      holidaysByEmp.set(m.employeeId, new Set((m.employee.holidayCalendar?.holidays ?? []).map((h) => isoDate(h.date))));
    }

    // osobodni = suma dni roboczych w sprincie wg kalendarza każdego członka
    let totalPersonDays = 0;
    for (const m of members) {
      totalPersonDays += countWorkingDays(sprint.dateFrom, sprint.dateTo, holidaysByEmp.get(m.employeeId));
    }

    const memberIds = members.map((m) => m.employeeId);
    const absences = await this.prisma.absence.findMany({
      where: { employeeId: { in: memberIds }, dateFrom: { lte: sprint.dateTo }, dateTo: { gte: sprint.dateFrom } },
      include: { type: true, employee: true },
    });

    let absentPersonDays = 0;
    for (const a of absences) {
      if (!a.type.affectsCapacity) continue;
      const from = a.dateFrom > sprint.dateFrom ? a.dateFrom : sprint.dateFrom;
      const to = a.dateTo < sprint.dateTo ? a.dateTo : sprint.dateTo;
      absentPersonDays += countWorkingDays(from, to, holidaysByEmp.get(a.employeeId) ?? new Set()) * fractionOf(a);
    }

    const keyAbsences = absences.filter((a) => a.employee.isKeyRole);

    return {
      sprint: { id: sprint.id, name: sprint.name, dateFrom: isoDate(sprint.dateFrom), dateTo: isoDate(sprint.dateTo) },
      unit: { id: unit.id, name: unit.name },
      memberCount: memberIds.length,
      totalPersonDays,
      absentPersonDays,
      available: Math.max(0, totalPersonDays - absentPersonDays),
      keyRoleCollisions: this.collisions(keyAbsences, sprint.dateFrom, sprint.dateTo),
    };
  }

  // FR-D3 — nakładające się nieobecności osób kluczowych w obrębie sprintu.
  private collisions(
    keyAbsences: { employeeId: string; dateFrom: Date; dateTo: Date; employee: { firstName: string; lastName: string } }[],
    sprintFrom: Date,
    sprintTo: Date,
  ): KeyRoleCollision[] {
    const out: KeyRoleCollision[] = [];
    for (let i = 0; i < keyAbsences.length; i++) {
      for (let j = i + 1; j < keyAbsences.length; j++) {
        const a = keyAbsences[i]!;
        const b = keyAbsences[j]!;
        if (a.employeeId === b.employeeId) continue;
        const from = maxDate(a.dateFrom, b.dateFrom, sprintFrom);
        const to = minDate(a.dateTo, b.dateTo, sprintTo);
        if (from <= to) {
          out.push({
            dateFrom: isoDate(from),
            dateTo: isoDate(to),
            employees: [`${a.employee.firstName} ${a.employee.lastName}`, `${b.employee.firstName} ${b.employee.lastName}`],
          });
        }
      }
    }
    return out;
  }
}
