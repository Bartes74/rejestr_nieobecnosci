// FR-G3 — polskie dni ustawowo wolne od pracy, liczone, nie pobierane.
// Wdrożenie jest on-premise i bez zależności od usług zewnętrznych, więc kalendarz świąt
// wyliczamy z ustawy: część dat jest stała, reszta wynika z daty Wielkanocy.

/** Wielkanoc (niedziela) w kalendarzu gregoriańskim — algorytm Meeusa/Jonesa/Butchera. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return new Date(Date.UTC(year, Math.floor(n / 31) - 1, (n % 31) + 1));
}

const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/**
 * Dni ustawowo wolne od pracy w Polsce dla danego roku (Dz.U. 1951 nr 4 poz. 28 ze zm.).
 * Wigilia jest dniem wolnym dopiero od 2025 (nowelizacja z 6.12.2024), więc zależy od roku.
 * Wielkanoc i Zielone Świątki zawsze wypadają w niedzielę — zostają na liście dla kompletności,
 * naliczanie i tak pomija weekendy.
 */
export function polishHolidays(year: number): { date: Date; name: string }[] {
  const easter = easterSunday(year);
  const fixed: [number, number, string][] = [
    [1, 1, 'Nowy Rok'],
    [1, 6, 'Święto Trzech Króli'],
    [5, 1, 'Święto Pracy'],
    [5, 3, 'Święto Narodowe Trzeciego Maja'],
    [8, 15, 'Wniebowzięcie Najświętszej Maryi Panny'],
    [11, 1, 'Wszystkich Świętych'],
    [11, 11, 'Narodowe Święto Niepodległości'],
    ...(year >= 2025 ? ([[12, 24, 'Wigilia Bożego Narodzenia']] as [number, number, string][]) : []),
    [12, 25, 'Boże Narodzenie (pierwszy dzień)'],
    [12, 26, 'Boże Narodzenie (drugi dzień)'],
  ];
  return [
    ...fixed.map(([m, d, name]) => ({ date: new Date(Date.UTC(year, m - 1, d)), name })),
    { date: easter, name: 'Niedziela Wielkanocna' },
    { date: plusDays(easter, 1), name: 'Poniedziałek Wielkanocny' },
    { date: plusDays(easter, 49), name: 'Zielone Świątki' },
    { date: plusDays(easter, 60), name: 'Boże Ciało' },
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}
