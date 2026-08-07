import { describe, expect, it } from 'vitest';
import { todayIso, todayUtc } from './today.js';
import { resolveBillingPeriod } from './period.js';

// Każdy przypadek to moment, w którym UTC i Warszawa pokazują różny dzień. Wartości `now`
// są podane w UTC (sufiks Z), a oczekiwania — w dacie, którą w tej chwili ma organizacja.
describe('todayIso — dzień w strefie organizacji', () => {
  it('po północy czasu letniego (UTC+2) daje już nowy dzień', () => {
    // 22:10 UTC = 00:10 następnego dnia w Warszawie. To dokładnie ten przypadek, w którym
    // formularz nieobecności podpowiadał wczoraj.
    expect(todayIso(new Date('2026-08-07T22:10:00Z'))).toBe('2026-08-08');
  });

  it('po północy czasu zimowego (UTC+1) też daje nowy dzień', () => {
    expect(todayIso(new Date('2026-01-14T23:30:00Z'))).toBe('2026-01-15');
  });

  it('przed północą lokalną trzyma się dnia bieżącego', () => {
    // 21:00 UTC = 23:00 w Warszawie — wciąż ten sam dzień.
    expect(todayIso(new Date('2026-08-07T21:00:00Z'))).toBe('2026-08-07');
  });

  it('w środku dnia UTC i Warszawa zgadzają się co do daty', () => {
    expect(todayIso(new Date('2026-08-07T10:00:00Z'))).toBe('2026-08-07');
  });

  it('przełom roku: 23:30 UTC 31 grudnia to już 1 stycznia w Warszawie', () => {
    expect(todayIso(new Date('2025-12-31T23:30:00Z'))).toBe('2026-01-01');
  });
});

describe('todayUtc — ta sama data jako północ UTC', () => {
  it('zwraca północ UTC dnia lokalnego, nie przesunięty moment', () => {
    const d = todayUtc(new Date('2026-08-07T22:10:00Z'));
    expect(d.toISOString()).toBe('2026-08-08T00:00:00.000Z');
  });

  it('nadaje się jako wejście dla resolveBillingPeriod', () => {
    // Sedno błędu przy przełomie roku: o 23:30 UTC 31 grudnia pracownik UoP powinien już
    // rozliczać się z puli roku 2026, a nie 2025.
    const noworoczny = new Date('2025-12-31T23:30:00Z');
    expect(resolveBillingPeriod('UOP', noworoczny).year).toBe(2025); // surowe „teraz" — źle
    expect(resolveBillingPeriod('UOP', todayUtc(noworoczny)).year).toBe(2026); // po korekcie — dobrze
  });
});
