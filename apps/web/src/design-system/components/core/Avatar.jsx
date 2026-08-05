import React from 'react';

const TONES = {
  brand:   { color: 'var(--brand)', background: 'var(--brand-tint)' },
  blue:    { color: 'var(--blue)', background: 'var(--blue-tint)' },
  neutral: { color: 'var(--ink-2)', background: 'var(--surface-3)' },
};

export function Avatar({ initials, tone = 'brand', size = 32, style }) {
  const t = TONES[tone] || TONES.brand;
  return (
    <span style={{ width: size, height: size, flex: 'none', borderRadius: Math.round(size * 0.26),
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)',
      fontWeight: 700, fontSize: Math.round(size * 0.38), ...t, ...style }}>
      {initials}
    </span>
  );
}
