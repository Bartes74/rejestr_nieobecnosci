import { describe, it, expect } from 'vitest';
import { billingPeriodsBefore, resolveBillingPeriod } from './period.js';
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

describe('billingPeriodsBefore — FR-B7 (łańcuch okresów do rolowania)', () => {
  it('UoP — kolejne lata kalendarzowe, bez okresu docelowego', () => {
    const ps = billingPeriodsBefore('UOP', new Date(Date.UTC(2024, 2, 10)), 2027);
    expect(ps.map((p) => [isoDate(p.from), isoDate(p.to)])).toEqual([
      ['2024-01-01', '2024-12-31'], ['2025-01-01', '2025-12-31'], ['2026-01-01', '2026-12-31'],
    ]);
  });

  it('B2B — kolejne lata budżetowe (gru–lis), bez luk i bez zakładek', () => {
    const ps = billingPeriodsBefore('B2B', new Date(Date.UTC(2025, 5, 1)), 2027);
    expect(ps.map((p) => [isoDate(p.from), isoDate(p.to)])).toEqual([
      ['2024-12-01', '2025-11-30'], ['2025-12-01', '2026-11-30'], // drugi startuje dzień po pierwszym
    ]);
    expect(ps.map((p) => p.year)).toEqual([2025, 2026]);
  });

  it('zatrudnienie w okresie docelowym → nie ma z czego rolować', () => {
    expect(billingPeriodsBefore('UOP', new Date(Date.UTC(2026, 6, 1)), 2026)).toEqual([]);
  });

  it('zatrudnienie po okresie docelowym → pusta lista, nie pętla', () => {
    expect(billingPeriodsBefore('UOP', new Date(Date.UTC(2030, 0, 1)), 2026)).toEqual([]);
  });
});
