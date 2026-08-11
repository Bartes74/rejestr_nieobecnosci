import type { CSSProperties } from 'react';

/**
 * Receptury powierzchni — obiekty stylu do rozłożenia w `style={{ ...card, padding: 24 }}`.
 *
 * Dlaczego receptura, a nie komponent: karta w tej aplikacji bywa dzieckiem gridu, ma własne
 * `gridColumn`, `overflow` albo wewnętrzny nagłówek z przyciskiem. Komponent narzucałby strukturę,
 * której dwanaście miejsc nie dzieli, a to właśnie zmuszało ekrany do deklarowania własnych
 * `const card = {…}` — i do rozjeżdżania się wartości (promień 16 vs 14 vs var(--radius-xl)).
 * Receptura zabija duplikat, nie dotykając struktury JSX.
 *
 * Do stałej struktury służą komponenty (StatCard, AbsencePill) — te zostają.
 */

/** Karta główna: powierzchnia na płótnie, włoskowata krawędź, cień spoczynkowy. */
export const card: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-sm)',
};

/** Karta z przyciętą zawartością — tabele i listy, które mają się obcinać do promienia. */
export const cardClipped: CSSProperties = { ...card, overflow: 'hidden' };

/** Panel wewnętrzny: mniejszy promień, bez cienia — leży już na karcie. */
export const panel: CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
};
