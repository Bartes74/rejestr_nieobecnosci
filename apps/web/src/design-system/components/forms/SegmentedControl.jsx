import React from 'react';

/**
 * Wybór jednej z 2–4 rozłącznych opcji. Jedyny wygląd tej kontrolki w aplikacji:
 * tor w `surface-2` z obramowaniem, aktywny segment wyskakuje na `surface` z cieniem
 * spoczynkowym (DESIGN.md → Components → Segmented control).
 *
 * `aria-pressed` zamiast `role="radio"`: stan „wybrany" jest tu zakodowany wyłącznie
 * kolorem, a wzorzec radiogroup wymagałby obsługi strzałek, której ten filtr nie potrzebuje —
 * segmenty są równorzędne i dostępne pojedynczym Tabem.
 */
export function SegmentedControl({ options, value, onChange, label, style }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'inline-flex', gap: 4, background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: 3, ...style }}>
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const text = typeof o === 'string' ? o : o.label;
        const active = val === value;
        return (
          <button key={val} type="button" aria-pressed={active} className={active ? undefined : 'ds-quiet'}
            onClick={() => onChange && onChange(val)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12.5, padding: '6px 13px', borderRadius: 'var(--radius-sm)',
              color: active ? 'var(--brand)' : 'var(--muted)', background: active ? 'var(--surface)' : 'transparent',
              boxShadow: active ? 'var(--shadow-sm)' : 'none' }}>
            {typeof o !== 'string' && o.icon}{text}
          </button>
        );
      })}
    </div>
  );
}
