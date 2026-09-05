import { describe, it, expect } from 'vitest';
import { carriedOverInto, consumesPool, minPoolFor, usedLeaveDays, balance, proratePool } from './balance.js';

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

describe('consumesPool — FR-B5 dotyczy wyłącznie UoP', () => {
  it('L4 nie obciąża puli na UoP, ale obciąża poza UoP', () => {
    expect(consumesPool('UOP', false)).toBe(false);
    expect(consumesPool('B2B', false)).toBe(true);
    expect(consumesPool('OUT', false)).toBe(true);
  });

  it('typ obciążający pulę obciąża ją przy każdej formie', () => {
    expect(consumesPool('UOP', true)).toBe(true);
    expect(consumesPool('B2B', true)).toBe(true);
  });

  it('ten sam wpis L4: pominięty na UoP, policzony na B2B', () => {
    const l4 = { dateFrom: d(2026, 6, 1), dateTo: d(2026, 6, 3) }; // śr–pt, 3 dni robocze
    const spanFor = (t: 'UOP' | 'B2B') => [{ ...l4, affectsPool: consumesPool(t, false) }];
    expect(usedLeaveDays(spanFor('UOP'), period)).toBe(0);
    expect(usedLeaveDays(spanFor('B2B'), period)).toBe(3);
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

describe('carriedOverInto — FR-B7 (urlop nie przepada na przełomie okresu)', () => {
  it('brak wcześniejszych okresów → zero, nie „coś z niczego"', () => {
    expect(carriedOverInto([])).toBe(0);
  });

  it('niewykorzystana część puli przechodzi do następnego okresu', () => {
    expect(carriedOverInto([{ pool: 26, used: 20 }])).toBe(6);
  });

  it('kumuluje przez kilka okresów — zaległe wchodzą do puli następnego', () => {
    // 2026: 26 − 20 = 6 zaległych → 2027: 26 + 6 − 24 = 8
    expect(carriedOverInto([{ pool: 26, used: 20 }, { pool: 26, used: 24 }])).toBe(8);
  });

  it('pula wybrana co do dnia → zero, bez śladowych ułamków', () => {
    expect(carriedOverInto([{ pool: 26, used: 26 }])).toBe(0);
  });

  it('korekta administratora wygrywa i staje się podstawą łańcucha', () => {
    // Administrator ustawił 2 dni zaległe na 2026 mimo wyliczonych 6; 2027 liczy się od tej wartości.
    expect(carriedOverInto([{ pool: 26, used: 20, explicit: 2 }])).toBe(8); // 26 + 2 − 20
    expect(carriedOverInto([{ pool: 26, used: 20 }, { pool: 26, used: 24, explicit: 0 }])).toBe(2); // 26 + 0 − 24
  });

  it('korekta 0 to nie to samo co brak korekty', () => {
    expect(carriedOverInto([{ pool: 10, used: 0, explicit: 0 }, { pool: 10, used: 0 }])).toBe(20);
    expect(carriedOverInto([{ pool: 10, used: 0 }, { pool: 10, used: 0 }])).toBe(20);
    expect(carriedOverInto([{ pool: 10, used: 0 }, { pool: 10, used: 0, explicit: 0 }])).toBe(10);
  });

  it('dług nie roluje się na kolejny okres', () => {
    expect(carriedOverInto([{ pool: 10, used: 15 }])).toBe(0);
    expect(carriedOverInto([{ pool: 10, used: 15 }, { pool: 10, used: 0 }])).toBe(10);
  });

  it('niepełne dni nie gubią połówek', () => {
    expect(carriedOverInto([{ pool: 26, used: 20.5 }])).toBe(5.5);
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

describe('minPoolFor — minimum puli dla form w roku budżetowym', () => {
  it('B2B i OUT mają 20 dni, UoP nie ma minimum', () => {
    expect(minPoolFor('B2B')).toBe(20);
    expect(minPoolFor('OUT')).toBe(20);
    expect(minPoolFor('UOP')).toBe(0);
  });
});
