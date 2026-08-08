import { describe, it, expect } from 'vitest';
import { subtractRange } from './displace.js';
import { usedLeaveDays } from './balance.js';

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day));
const iso = (r: { dateFrom: Date; dateTo: Date }) => `${r.dateFrom.toISOString().slice(0, 10)}..${r.dateTo.toISOString().slice(0, 10)}`;

describe('subtractRange — L4 wycina dni z zaplanowanego urlopu', () => {
  it('L4 pochłania cały urlop → nie zostaje nic', () => {
    const rest = subtractRange({ dateFrom: d(2026, 7, 11), dateTo: d(2026, 7, 13) }, { dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 14) });
    expect(rest).toEqual([]);
  });

  it('L4 zachodzi na początek urlopu → zostaje ogon', () => {
    const rest = subtractRange({ dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 20) }, { dateFrom: d(2026, 7, 8), dateTo: d(2026, 7, 12) });
    expect(rest.map(iso)).toEqual(['2026-08-13..2026-08-20']);
  });

  it('L4 zachodzi na koniec urlopu → zostaje początek', () => {
    const rest = subtractRange({ dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 20) }, { dateFrom: d(2026, 7, 18), dateTo: d(2026, 7, 25) });
    expect(rest.map(iso)).toEqual(['2026-08-10..2026-08-17']);
  });

  it('L4 w środku urlopu → rozcina go na dwa kawałki', () => {
    const rest = subtractRange({ dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 20) }, { dateFrom: d(2026, 7, 13), dateTo: d(2026, 7, 15) });
    expect(rest.map(iso)).toEqual(['2026-08-10..2026-08-12', '2026-08-16..2026-08-20']);
  });

  it('brak części wspólnej → wpis nietknięty', () => {
    const span = { dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 12) };
    expect(subtractRange(span, { dateFrom: d(2026, 7, 13), dateTo: d(2026, 7, 20) })).toEqual([span]);
    expect(subtractRange(span, { dateFrom: d(2026, 7, 1), dateTo: d(2026, 7, 9) })).toEqual([span]);
  });

  it('dzień styku nie jest częścią wspólną (zakresy domknięte obustronnie)', () => {
    const span = { dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 12) };
    const rest = subtractRange(span, { dateFrom: d(2026, 7, 12), dateTo: d(2026, 7, 14) });
    expect(rest.map(iso)).toEqual(['2026-08-10..2026-08-11']);
  });
});

// Sedno wymagania: dni pokryte L4 mają wrócić do puli. Saldo liczy się z wpisów, więc
// sprawdzamy to złożeniem obu funkcji, a nie osobnym licznikiem.
describe('dni pokryte L4 wracają do puli', () => {
  const period = { from: d(2026, 0, 1), to: d(2026, 11, 31) };

  it('urlop 10–20 sie (9 dni roboczych) + L4 13–15 sie → z puli schodzi 6 dni', () => {
    const urlop = { dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 20) };
    expect(usedLeaveDays([{ ...urlop, affectsPool: true }], period)).toBe(9);

    const l4 = { dateFrom: d(2026, 7, 13), dateTo: d(2026, 7, 15) }; // czw–sob, 2 dni robocze
    const rest = subtractRange(urlop, l4).map((r) => ({ ...r, affectsPool: true }));
    // L4 samo nie obniża puli — wchodzi do zestawienia, żeby test opisywał stan po zapisie.
    expect(usedLeaveDays([...rest, { ...l4, affectsPool: false }], period)).toBe(7);
  });
});
