import { describe, it, expect } from 'vitest';
import { plural, count, pluralForm } from './plural.js';

const OSOBA = ['osoba', 'osoby', 'osób'] as const;
const DZIEN = ['dzień', 'dni', 'dni'] as const;

describe('plural — polskie formy liczby mnogiej (CLDR pl)', () => {
  it('one: tylko dokładnie 1', () => {
    expect(plural(1, OSOBA)).toBe('osoba');
    expect(plural(21, OSOBA)).not.toBe('osoba'); // 21 to „osób", nie „osoba"
  });

  it('few: końcówki 2–4 poza nastoletnimi', () => {
    for (const n of [2, 3, 4, 22, 23, 24, 102, 1004]) {
      expect(plural(n, OSOBA)).toBe('osoby');
    }
  });

  it('many: 0, 5–21 i nastoletnie końcówki', () => {
    for (const n of [0, 5, 9, 11, 12, 13, 14, 19, 21, 25, 112, 113, 114]) {
      expect(plural(n, OSOBA)).toBe('osób');
    }
  });

  it('ułamki sprowadzamy do formy many (nie stoją przy rzeczowniku w UI)', () => {
    expect(pluralForm(0.5)).toBe(2);
    expect(plural(2.5, DZIEN)).toBe('dni');
  });

  it('liczby ujemne odmieniają się jak dodatnie', () => {
    expect(plural(-3, OSOBA)).toBe('osoby');
    expect(plural(-7, OSOBA)).toBe('osób');
  });

  it('count skleja liczbę z właściwą formą', () => {
    expect(count(1, OSOBA)).toBe('1 osoba');
    expect(count(3, OSOBA)).toBe('3 osoby');
    expect(count(5, OSOBA)).toBe('5 osób');
    expect(count(22, DZIEN)).toBe('22 dni');
  });
});
