import { describe, it, expect } from 'vitest';
import { sprintCapacity } from './capacity.js';

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day));
const sprint = { from: d(2026, 5, 22), to: d(2026, 6, 3) }; // 22.06–03.07.2026 = 10 dni roboczych

describe('sprintCapacity — FR-D2', () => {
  it('osobodni = liczba osób × dni robocze sprintu', () => {
    const r = sprintCapacity(3, sprint, []);
    expect(r.totalPersonDays).toBe(30); // 3 × 10
    expect(r.available).toBe(30);
  });

  it('nieobecność (w tym L4) pomniejsza capacity', () => {
    const r = sprintCapacity(3, sprint, [
      { dateFrom: d(2026, 5, 22), dateTo: d(2026, 5, 26), affectsCapacity: true }, // 5 dni
    ]);
    expect(r.absentPersonDays).toBe(5);
    expect(r.available).toBe(25);
  });

  it('typ nie wpływający na capacity jest pomijany', () => {
    const r = sprintCapacity(3, sprint, [
      { dateFrom: d(2026, 5, 22), dateTo: d(2026, 5, 26), affectsCapacity: false },
    ]);
    expect(r.absentPersonDays).toBe(0);
    expect(r.available).toBe(30);
  });
});
