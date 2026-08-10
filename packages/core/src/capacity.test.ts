import { describe, it, expect } from 'vitest';
import { sprintCapacity } from './capacity.js';
import type { CapacityAbsence } from './capacity.js';

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day));
const sprint = { from: d(2026, 5, 22), to: d(2026, 6, 3) }; // 22.06–03.07.2026 = 10 dni roboczych
const team = (...people: CapacityAbsence[][]) => people.map((absences) => ({ absences }));

describe('sprintCapacity — FR-D2', () => {
  it('osobodni = liczba osób × dni robocze sprintu', () => {
    const r = sprintCapacity(team([], [], []), sprint);
    expect(r.totalPersonDays).toBe(30); // 3 × 10
    expect(r.available).toBe(30);
  });

  it('nieobecność (w tym L4) pomniejsza capacity', () => {
    const r = sprintCapacity(team([{ dateFrom: d(2026, 5, 22), dateTo: d(2026, 5, 26), affectsCapacity: true }], [], []), sprint);
    expect(r.absentPersonDays).toBe(5);
    expect(r.available).toBe(25);
  });

  it('typ nie wpływający na capacity jest pomijany', () => {
    const r = sprintCapacity(team([{ dateFrom: d(2026, 5, 22), dateTo: d(2026, 5, 26), affectsCapacity: false }], [], []), sprint);
    expect(r.absentPersonDays).toBe(0);
    expect(r.available).toBe(30);
  });

  it('L4 nałożone na zaplanowaną nieobecność nie liczy dnia dwa razy', () => {
    const r = sprintCapacity(team([
      { dateFrom: d(2026, 5, 22), dateTo: d(2026, 5, 26), affectsCapacity: true }, // 5 dni
      { dateFrom: d(2026, 5, 24), dateTo: d(2026, 5, 26), affectsCapacity: true, overrides: true }, // 3 dni wspólne
    ], [], []), sprint);
    expect(r.absentPersonDays).toBe(5); // nie 8
    expect(r.available).toBe(25);
  });

  it('nieobecność osoby nie przekracza jej dni roboczych w sprincie', () => {
    const r = sprintCapacity(team([
      { dateFrom: d(2026, 5, 1), dateTo: d(2026, 7, 31), affectsCapacity: true }, // dużo dłuższa niż sprint
      { dateFrom: d(2026, 5, 22), dateTo: d(2026, 6, 3), affectsCapacity: true, overrides: true },
    ], [], []), sprint);
    expect(r.absentPersonDays).toBe(10); // dokładnie tyle, ile osoba ma dni roboczych
    expect(r.available).toBe(20);
  });

  it('święta z kalendarza osoby wypadają z jej osobodni', () => {
    const r = sprintCapacity([{ absences: [], holidays: new Set(['2026-06-22', '2026-06-23']) }], sprint);
    expect(r.totalPersonDays).toBe(8);
  });
});
