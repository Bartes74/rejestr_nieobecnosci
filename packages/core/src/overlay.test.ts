import { describe, it, expect } from 'vitest';
import { countOverlaidDays, mergeRanges, subtractRange, subtractRanges } from './overlay.js';
import { consumesPool, usedLeaveDays } from './balance.js';

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day));
const iso = (r: { dateFrom: Date; dateTo: Date }) => `${r.dateFrom.toISOString().slice(0, 10)}..${r.dateTo.toISOString().slice(0, 10)}`;
const period = { from: d(2026, 0, 1), to: d(2026, 11, 31) };

describe('subtractRange — dni pokryte L4 znikają z pokazywanego zakresu', () => {
  it('L4 pochłania cały wpis → nie zostaje nic', () => {
    const rest = subtractRange({ dateFrom: d(2026, 7, 11), dateTo: d(2026, 7, 13) }, { dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 14) });
    expect(rest).toEqual([]);
  });

  it('L4 zachodzi na początek → zostaje ogon', () => {
    const rest = subtractRange({ dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 20) }, { dateFrom: d(2026, 7, 8), dateTo: d(2026, 7, 12) });
    expect(rest.map(iso)).toEqual(['2026-08-13..2026-08-20']);
  });

  it('L4 zachodzi na koniec → zostaje początek', () => {
    const rest = subtractRange({ dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 20) }, { dateFrom: d(2026, 7, 18), dateTo: d(2026, 7, 25) });
    expect(rest.map(iso)).toEqual(['2026-08-10..2026-08-17']);
  });

  it('L4 w środku → rozcina zakres na dwa kawałki', () => {
    const rest = subtractRange({ dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 20) }, { dateFrom: d(2026, 7, 13), dateTo: d(2026, 7, 15) });
    expect(rest.map(iso)).toEqual(['2026-08-10..2026-08-12', '2026-08-16..2026-08-20']);
  });

  it('brak części wspólnej → zakres nietknięty', () => {
    const span = { dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 12) };
    expect(subtractRange(span, { dateFrom: d(2026, 7, 13), dateTo: d(2026, 7, 20) })).toEqual([span]);
    expect(subtractRange(span, { dateFrom: d(2026, 7, 1), dateTo: d(2026, 7, 9) })).toEqual([span]);
  });

  it('dzień styku jest częścią wspólną (zakresy domknięte obustronnie)', () => {
    const span = { dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 12) };
    const rest = subtractRange(span, { dateFrom: d(2026, 7, 12), dateTo: d(2026, 7, 14) });
    expect(rest.map(iso)).toEqual(['2026-08-10..2026-08-11']);
  });

  it('dwa L4 na jednym wpisie odejmują się naraz', () => {
    const rest = subtractRanges({ dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 20) }, [
      { dateFrom: d(2026, 7, 12), dateTo: d(2026, 7, 13) },
      { dateFrom: d(2026, 7, 17), dateTo: d(2026, 7, 18) },
    ]);
    expect(rest.map(iso)).toEqual(['2026-08-10..2026-08-11', '2026-08-14..2026-08-16', '2026-08-19..2026-08-20']);
  });
});

describe('mergeRanges — dla oglądającego bez prawa do powodu to jedna nieobecność', () => {
  it('zakresy nakładające się scalają się w jeden blok', () => {
    const out = mergeRanges([
      { dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 14) },
      { dateFrom: d(2026, 7, 12), dateTo: d(2026, 7, 21) },
    ]);
    expect(out.map(iso)).toEqual(['2026-08-10..2026-08-21']);
  });

  it('zakresy stykające się dzień w dzień też się łączą', () => {
    const out = mergeRanges([
      { dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 11) },
      { dateFrom: d(2026, 7, 12), dateTo: d(2026, 7, 13) },
    ]);
    expect(out.map(iso)).toEqual(['2026-08-10..2026-08-13']);
  });

  it('zakresy z przerwą zostają osobno, posortowane', () => {
    const out = mergeRanges([
      { dateFrom: d(2026, 7, 20), dateTo: d(2026, 7, 21) },
      { dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 11) },
    ]);
    expect(out.map(iso)).toEqual(['2026-08-10..2026-08-11', '2026-08-20..2026-08-21']);
  });

  it('nie modyfikuje wejścia', () => {
    const src = [{ dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 11) }, { dateFrom: d(2026, 7, 12), dateTo: d(2026, 7, 13) }];
    mergeRanges(src);
    expect(iso(src[0]!)).toBe('2026-08-10..2026-08-11');
  });
});

describe('countOverlaidDays — dzień liczy się raz i należy do L4', () => {
  it('dzień pokryty przez L4 nie zabiera z puli na UoP', () => {
    const days = countOverlaidDays(
      [
        { dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 14), overrides: false, counts: true }, // pn–pt
        { dateFrom: d(2026, 7, 12), dateTo: d(2026, 7, 12), overrides: true, counts: false }, // środa, L4
      ],
      period,
    );
    expect(days).toBe(4);
  });

  it('poza UoP ten sam układ kosztuje pięć dni, nie sześć', () => {
    const days = countOverlaidDays(
      [
        { dateFrom: d(2026, 7, 10), dateTo: d(2026, 7, 14), overrides: false, counts: true },
        { dateFrom: d(2026, 7, 12), dateTo: d(2026, 7, 12), overrides: true, counts: true },
      ],
      period,
    );
    expect(days).toBe(5);
  });

  it('pół dnia choroby nie przejmuje całego dnia — ułamki sumują się z zaciskiem do jednego', () => {
    const half = countOverlaidDays(
      [
        { dateFrom: d(2026, 7, 12), dateTo: d(2026, 7, 12), overrides: false, counts: true, fraction: 0.5 },
        { dateFrom: d(2026, 7, 12), dateTo: d(2026, 7, 12), overrides: true, counts: false, fraction: 0.5 },
      ],
      period,
    );
    expect(half).toBe(0.5); // liczy się tylko połowa urlopowa

    const capped = countOverlaidDays(
      [
        { dateFrom: d(2026, 7, 12), dateTo: d(2026, 7, 12), overrides: false, counts: true, fraction: 0.5 },
        { dateFrom: d(2026, 7, 12), dateTo: d(2026, 7, 12), overrides: true, counts: true, fraction: 1 },
      ],
      period,
    );
    expect(capped).toBe(1); // całodniowe L4 przejmuje dzień mimo pół dnia urlopu
  });

  it('weekendy, święta i dni spoza okresu nie wchodzą do rachunku', () => {
    const days = countOverlaidDays(
      [{ dateFrom: d(2025, 11, 30), dateTo: d(2026, 0, 2), overrides: false, counts: true }],
      period,
      new Set(['2026-01-01']),
    );
    expect(days).toBe(1); // 01.01 święto, 02.01 piątek; grudzień poza okresem
  });
});

// Kryterium odbioru wprost z wymagania: 5 dni nieobecności, potem 8 dni L4, z czego 3 wspólne.
// Suma dni kalendarzowych to 10. Na UoP z puli schodzą 2 dni (zwrot 3), poza UoP — 10.
describe('kryterium odbioru: 5 dni + 8 dni L4 z 3 wspólnymi', () => {
  const nieobecnosc = { dateFrom: d(2026, 7, 3), dateTo: d(2026, 7, 7) }; // pn–pt, 5 dni roboczych
  const l4 = { dateFrom: d(2026, 7, 5), dateTo: d(2026, 7, 14) }; // śr–wt, 8 dni roboczych, 3 wspólne

  const spansFor = (t: 'UOP' | 'OUT') => [
    { ...nieobecnosc, overrides: false, counts: consumesPool(t, true) },
    { ...l4, overrides: true, counts: consumesPool(t, false) },
  ];

  it('sama nieobecność to 5 dni', () => {
    expect(usedLeaveDays([{ ...nieobecnosc, affectsPool: true }], period)).toBe(5);
  });

  it('UoP: z puli schodzą 2 dni — 3 dni wróciły', () => {
    expect(countOverlaidDays(spansFor('UOP'), period)).toBe(2);
  });

  it('EXT/B2B: z puli schodzi 10 dni — każdy dzień raz, żaden dwa razy', () => {
    expect(countOverlaidDays(spansFor('OUT'), period)).toBe(10);
  });

  it('do pokazania: nieobecność kurczy się do 2 dni, L4 idzie w całości', () => {
    expect(subtractRanges(nieobecnosc, [l4]).map(iso)).toEqual(['2026-08-03..2026-08-04']);
  });

  it('bez prawa do powodu: jeden ciągły blok 10 dni', () => {
    expect(mergeRanges([nieobecnosc, l4]).map(iso)).toEqual(['2026-08-03..2026-08-14']);
  });
});
