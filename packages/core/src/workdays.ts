// FR-A2 / FR-G3 — liczenie dni roboczych: pomija weekendy i święta z kalendarza osoby.
// FR-A3 — niepełne dni (AM/PM/godziny) jako ułamek dnia w systemie 8-godzinnym.

export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

/** Liczba dni roboczych w zakresie [from, to] (włącznie), z pominięciem weekendów i świąt. */
export function countWorkingDays(from: Date, to: Date, holidays: ReadonlySet<string> = new Set()): number {
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  let t = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  let count = 0;
  while (t <= end) {
    const cur = new Date(t);
    const day = cur.getUTCDay(); // 0 = niedziela, 6 = sobota
    if (day !== 0 && day !== 6 && !holidays.has(isoDate(cur))) count++;
    t += 86_400_000; // +1 dzień
  }
  return count;
}

export type DayPart = 'FULL' | 'AM' | 'PM' | 'HOURS';

/** Ułamek dnia dla wpisu. HOURS: (koniec − początek) / 8h. */
export function dayFraction(part: DayPart, hourFrom?: string, hourTo?: string, workdayHours = 8): number {
  if (part === 'FULL') return 1;
  if (part === 'AM' || part === 'PM') return 0.5;
  if (!hourFrom || !hourTo) return 0;
  const toMin = (s: string): number => {
    const [h, m] = s.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  return Math.max(0, toMin(hourTo) - toMin(hourFrom)) / (workdayHours * 60);
}
