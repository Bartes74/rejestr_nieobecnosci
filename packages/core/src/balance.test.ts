import { describe, it, expect } from 'vitest';
import { usedLeaveDays, balance, proratePool } from './balance.js';

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day));
const period = { from: d(2026, 0, 1), to: d(2026, 11, 31) };

describe('usedLeaveDays — FR-B5 (L4 nie obniża puli)', () => {
  it('sumuje urlop, pomija L4 (affectsPool=false)', () => {
    const used = usedLeaveDays(
      [
        { dateFrom: d(2026, 5, 22), dateTo: d(2026, 5, 26), affectsPool: true }, // 5 dni urlopu
        { dateFrom: d(2026, 6, 1), dateTo: d(2026, 6, 3), affectsPool: false }, // L4 — pomijane
      ],
      period,
    );
    expect(used).toBe(5);
  });

  it('niepełny dzień liczony jako ułamek', () => {
    const used = usedLeaveDays(
      [{ dateFrom: d(2026, 5, 22), dateTo: d(2026, 5, 22), affectsPool: true, fraction: 0.5 }],
      period,
    );
    expect(used).toBe(0.5);
  });

  it('wpis spoza okresu przycięty (tylko część w okresie)', () => {
    // 30.12.2025 – 02.01.2026, okres = rok 2026 → liczone tylko dni robocze od 01.01
    const used = usedLeaveDays(
      [{ dateFrom: d(2025, 11, 30), dateTo: d(2026, 0, 2), affectsPool: true }],
      period,
    );
    expect(used).toBe(2); // 01.01 (czw) i 02.01 (pt) 2026
  });
});

describe('balance — FR-B2/B7', () => {
  it('pozostało = pula + zaległe − wykorzystano', () => {
    expect(balance(26, 4, 5).remaining).toBe(25);
  });

  it('urlop zaległy zawsze powiększa pulę (nigdy nie przepada)', () => {
    expect(balance(26, 10, 0).remaining).toBe(36);
  });
});

describe('proratePool — FR-B9', () => {
  const period2026 = { from: d(2026, 0, 1), to: d(2026, 11, 31) };
  it('zatrudnienie obejmujące cały okres → pełna pula', () => {
    expect(proratePool(26, period2026, d(2025, 0, 1))).toBe(26);
    expect(proratePool(26, period2026, d(2026, 0, 1))).toBe(26);
  });
  it('zatrudniony od 1 lipca → ~połowa puli', () => {
    const p = proratePool(26, period2026, d(2026, 6, 1));
    expect(p).toBeGreaterThan(12);
    expect(p).toBeLessThan(14);
  });
  it('odejście przed okresem → 0', () => {
    expect(proratePool(26, period2026, d(2025, 0, 1), d(2025, 5, 1))).toBe(0);
  });
});
