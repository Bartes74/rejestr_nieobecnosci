import { describe, it, expect } from 'vitest';
import { easterSunday, polishHolidays } from './holidays-pl.js';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const on = (year: number, date: string) => polishHolidays(year).find((h) => iso(h.date) === date);

describe('easterSunday', () => {
  it('trafia w znane daty Wielkanocy', () => {
    expect(iso(easterSunday(2024))).toBe('2024-03-31');
    expect(iso(easterSunday(2025))).toBe('2025-04-20');
    expect(iso(easterSunday(2026))).toBe('2026-04-05');
  });
});

describe('polishHolidays — FR-G3', () => {
  it('wylicza święta ruchome względem Wielkanocy', () => {
    expect(on(2026, '2026-04-06')?.name).toBe('Poniedziałek Wielkanocny');
    expect(on(2026, '2026-06-04')?.name).toBe('Boże Ciało');
    expect(on(2026, '2026-05-24')?.name).toBe('Zielone Świątki');
  });

  it('zawiera święta stałe', () => {
    expect(on(2026, '2026-11-11')?.name).toBe('Narodowe Święto Niepodległości');
    expect(on(2026, '2026-12-26')).toBeDefined();
  });

  it('Wigilia jest dniem wolnym dopiero od 2025', () => {
    expect(on(2024, '2024-12-24')).toBeUndefined();
    expect(on(2025, '2025-12-24')?.name).toBe('Wigilia Bożego Narodzenia');
  });

  it('daty są unikalne i posortowane rosnąco', () => {
    const dates = polishHolidays(2026).map((h) => iso(h.date));
    expect(new Set(dates).size).toBe(dates.length);
    expect([...dates].sort()).toEqual(dates);
  });
});
