// FR-D2 — capacity squadu w sprincie: osobodni robocze pomniejszone o nieobecności i niepełne dni.
// Uwaga: L4 (affectsCapacity=true) pomniejsza capacity, mimo że na UoP nie rusza puli urlopu.
//
// Liczone per osoba, nie po płaskiej liście wpisów: wpisy jednej osoby mogą się nakładać
// (L4 na zaplanowanej nieobecności), a wtedy suma po wpisach wykazałaby więcej osobodni
// nieobecności, niż ta osoba w ogóle ma dni roboczych w sprincie.

import { countOverlaidDays } from './overlay.js';
import { countWorkingDays } from './workdays.js';

export interface CapacityAbsence {
  dateFrom: Date;
  dateTo: Date;
  affectsCapacity: boolean;
  overrides?: boolean; // wpis chorobowy — przejmuje dzień
  fraction?: number;
}

export interface CapacityMember {
  absences: readonly CapacityAbsence[];
  holidays?: ReadonlySet<string>; // kalendarz świąt tej osoby (FR-G7)
}

export interface CapacityResult {
  totalPersonDays: number;
  absentPersonDays: number;
  available: number;
}

export function sprintCapacity(
  members: readonly CapacityMember[],
  sprint: { from: Date; to: Date },
): CapacityResult {
  let totalPersonDays = 0;
  let absentPersonDays = 0;

  for (const m of members) {
    const workingDays = countWorkingDays(sprint.from, sprint.to, m.holidays);
    totalPersonDays += workingDays;
    const absent = countOverlaidDays(
      m.absences.map((a) => ({
        dateFrom: a.dateFrom, dateTo: a.dateTo,
        overrides: a.overrides ?? false,
        counts: a.affectsCapacity,
        fraction: a.fraction,
      })),
      sprint,
      m.holidays,
    );
    // Zacisk do dni roboczych osoby: nikt nie jest nieobecny dłużej, niż mógłby być obecny.
    absentPersonDays += Math.min(workingDays, absent);
  }

  return { totalPersonDays, absentPersonDays, available: Math.max(0, totalPersonDays - absentPersonDays) };
}
