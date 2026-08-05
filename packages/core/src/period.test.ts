import { describe, it, expect } from 'vitest';
import { resolveBillingPeriod } from './period.js';
import { isoDate } from './workdays.js';

describe('resolveBillingPeriod — FR-B1 (warunek akceptacji)', () => {
  it('UoP = rok kalendarzowy', () => {
    const p = resolveBillingPeriod('UOP', new Date(Date.UTC(2026, 5, 15)));
    expect(isoDate(p.from)).toBe('2026-01-01');
    expect(isoDate(p.to)).toBe('2026-12-31');
    expect(p.type).toBe('CALENDAR');
    expect(p.year).toBe(2026);
  });

  it('B2B = rok budżetowy (gru–lis) dla daty w środku okresu', () => {
    const p = resolveBillingPeriod('B2B', new Date(Date.UTC(2026, 5, 15)));
    expect(isoDate(p.from)).toBe('2025-12-01');
    expect(isoDate(p.to)).toBe('2026-11-30');
    expect(p.type).toBe('BUDGET');
    expect(p.year).toBe(2026);
  });

  it('B2B — grudzień należy do KOLEJNEGO roku budżetowego', () => {
    const p = resolveBillingPeriod('B2B', new Date(Date.UTC(2025, 11, 10)));
    expect(isoDate(p.from)).toBe('2025-12-01');
    expect(isoDate(p.to)).toBe('2026-11-30');
    expect(p.year).toBe(2026);
  });

  it('OUT liczony jak B2B', () => {
    const p = resolveBillingPeriod('OUT', new Date(Date.UTC(2026, 0, 5)));
    expect(isoDate(p.from)).toBe('2025-12-01');
    expect(isoDate(p.to)).toBe('2026-11-30');
  });

  it('ta sama data, różne formy → różne okresy', () => {
    const d = new Date(Date.UTC(2026, 0, 15)); // 15 stycznia 2026
    expect(resolveBillingPeriod('UOP', d).year).toBe(2026);
    expect(isoDate(resolveBillingPeriod('UOP', d).from)).toBe('2026-01-01');
    expect(isoDate(resolveBillingPeriod('B2B', d).from)).toBe('2025-12-01');
  });
});
