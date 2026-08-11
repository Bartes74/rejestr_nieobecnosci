import { describe, it, expect } from 'vitest';
import { countWorkingDays, dayFraction } from './workdays.js';

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day));

describe('countWorkingDays — FR-A2', () => {
  it('pomija weekendy (pon 22.06 – pon 29.06.2026 = 6 dni roboczych)', () => {
    expect(countWorkingDays(d(2026, 5, 22), d(2026, 5, 29))).toBe(6);
  });

  it('pomija święta z kalendarza (24.06 wolne → 4 z 5)', () => {
    expect(countWorkingDays(d(2026, 5, 22), d(2026, 5, 26), new Set(['2026-06-24']))).toBe(4);
  });

  it('jeden dzień roboczy = 1', () => {
    expect(countWorkingDays(d(2026, 5, 22), d(2026, 5, 22))).toBe(1);
  });

  it('weekend = 0', () => {
    expect(countWorkingDays(d(2026, 5, 27), d(2026, 5, 28))).toBe(0);
  });

  it('zakres odwrócony = 0', () => {
    expect(countWorkingDays(d(2026, 5, 26), d(2026, 5, 22))).toBe(0);
  });
});

describe('dayFraction — FR-A3', () => {
  it('FULL=1, AM=0.5, PM=0.5', () => {
    expect(dayFraction('FULL')).toBe(1);
    expect(dayFraction('AM')).toBe(0.5);
    expect(dayFraction('PM')).toBe(0.5);
  });

  it('HOURS 09:00–13:00 = 0.5 dnia', () => {
    expect(dayFraction('HOURS', '09:00', '13:00')).toBe(0.5);
  });

  it('HOURS bez godzin = 0', () => {
    expect(dayFraction('HOURS')).toBe(0);
  });

  // Ułamek dnia trafia do sumowania w countOverlaidDays i stamtąd do salda urlopu.
  // Wartość spoza 0–1 albo NaN psuje saldo całej osoby, więc granice pilnujemy tutaj.
  it('zakres odwrócony = 0 (nie wartość ujemna)', () => {
    expect(dayFraction('HOURS', '17:00', '09:00')).toBe(0);
  });

  it('godziny w złym formacie = 0, nigdy NaN', () => {
    expect(dayFraction('HOURS', 'abc', 'def')).toBe(0);
    expect(dayFraction('HOURS', '', '13:00')).toBe(0);
    expect(dayFraction('HOURS', '09:00', 'xx:yy')).toBe(0);
  });

  it('zakres dłuższy niż dzień pracy zaciska się do 1', () => {
    expect(dayFraction('HOURS', '00:00', '23:59')).toBe(1);
    expect(dayFraction('HOURS', '06:00', '20:00')).toBe(1);
  });
});
