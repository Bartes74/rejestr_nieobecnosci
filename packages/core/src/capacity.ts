// FR-D2 — capacity squadu w sprincie: osobodni robocze pomniejszone o nieobecności i niepełne dni.
// Uwaga: L4 (affectsCapacity=true) pomniejsza capacity, mimo że nie rusza puli urlopu.

import { countWorkingDays } from './workdays.js';

export interface CapacityAbsence {
  dateFrom: Date;
  dateTo: Date;
  affectsCapacity: boolean;
  fraction?: number;
}

export interface CapacityResult {
  totalPersonDays: number;
  absentPersonDays: number;
  available: number;
}

export function sprintCapacity(
  memberCount: number,
  sprint: { from: Date; to: Date },
  absences: readonly CapacityAbsence[],
  holidays: ReadonlySet<string> = new Set(),
): CapacityResult {
  const workingDays = countWorkingDays(sprint.from, sprint.to, holidays);
  const totalPersonDays = memberCount * workingDays;

  let absentPersonDays = 0;
  for (const a of absences) {
    if (!a.affectsCapacity) continue;
    const from = a.dateFrom > sprint.from ? a.dateFrom : sprint.from;
    const to = a.dateTo < sprint.to ? a.dateTo : sprint.to;
    absentPersonDays += countWorkingDays(from, to, holidays) * (a.fraction ?? 1);
  }

  return { totalPersonDays, absentPersonDays, available: Math.max(0, totalPersonDays - absentPersonDays) };
}
