/**
 * Polska liczba mnoga (kategorie CLDR `one` / `few` / `many` dla języka `pl`).
 *
 * „2 osób" i „22 osoby" to najczęstszy błąd w interfejsach liczących ludzi i dni —
 * angielskie `n === 1 ? x : y` daje w polskim poprawny wynik tylko dla 1 i 5–21.
 *
 * Ułamki (0,5 dnia) mają w CLDR własną kategorię `other`; w tym produkcie
 * nigdy nie stoją przy rzeczowniku (wymiar dnia pokazujemy bez odmiany),
 * więc świadomie sprowadzamy je do formy `many`.
 */
export type PluralForms = readonly [one: string, few: string, many: string];

/** Indeks formy: 0 = one (1 osoba), 1 = few (2 osoby), 2 = many (5 osób). */
export function pluralForm(n: number): 0 | 1 | 2 {
  if (!Number.isInteger(n)) return 2;
  const abs = Math.abs(n);
  if (abs === 1) return 0;
  const ones = abs % 10;
  const tens = abs % 100;
  return ones >= 2 && ones <= 4 && (tens < 12 || tens > 14) ? 1 : 2;
}

/** `plural(3, ['osoba', 'osoby', 'osób'])` → `'osoby'`. Zwraca sam rzeczownik, bez liczby. */
export function plural(n: number, forms: PluralForms): string {
  return forms[pluralForm(n)];
}

/** `count(3, ['osoba', 'osoby', 'osób'])` → `'3 osoby'`. */
export function count(n: number, forms: PluralForms): string {
  return `${n} ${plural(n, forms)}`;
}
