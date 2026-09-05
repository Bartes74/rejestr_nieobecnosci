// FR-A2 / FR-G3 — liczenie dni roboczych: pomija weekendy i święta z kalendarza osoby.
// FR-A3 — niepełne dni (pół dnia / godziny) jako ułamek dnia w systemie 8-godzinnym.
// AM i PM dają ten sam ułamek: od uwag zleceniodawcy UI oferuje jedno „Pół dnia" (zapisywane jako AM),
// PM zostaje dla wpisów sprzed zmiany.

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

/**
 * Ułamek dnia dla wpisu. HOURS: (koniec − początek) / 8h.
 *
 * Wynik z definicji mieści się w przedziale 0–1: jednego dnia nie da się być nieobecnym
 * półtora raza. Zacisk jest tutaj, a nie u wywołujących, bo ta liczba wchodzi do sumowania
 * w `countOverlaidDays` i stamtąd wprost do salda urlopu — a `NaN` w sumie zamienia saldo
 * całej osoby w `NaN` (w JSON: `null`) i przepuszcza kontrolę przekroczenia puli, bo
 * `NaN > cokolwiek` jest fałszem. Godziny w złym formacie mają dać zero, nie truciznę.
 *
 * Zero dla braku godzin zostaje: sam ułamek nie ma jak orzec, czy to błąd wywołania, czy wpis
 * bez godzin. Odrzuceniem takiego wpisu zajmuje się walidacja przy zapisie (AbsencesService).
 */
export function dayFraction(part: DayPart, hourFrom?: string, hourTo?: string, workdayHours = 8): number {
  if (part === 'FULL') return 1;
  if (part === 'AM' || part === 'PM') return 0.5;
  if (!hourFrom || !hourTo) return 0;
  const toMin = (s: string): number => {
    const [h, m] = s.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const raw = (toMin(hourTo) - toMin(hourFrom)) / (workdayHours * 60);
  return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
}
