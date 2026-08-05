import React from 'react';

const TONES = {
  neutral: { color: 'var(--ink-2)', background: 'var(--surface-3)' },
  brand:   { color: 'var(--brand)', background: 'var(--brand-tint)' },
  blue:    { color: 'var(--blue)', background: 'var(--blue-tint)' },
  amber:   { color: 'var(--amber)', background: 'var(--amber-tint)' },
  danger:  { color: 'var(--danger)', background: 'var(--danger-tint)' },
};

export function Badge({ tone = 'neutral', mono = false, dot = false, children, style }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      fontSize: mono ? 11 : 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap',
      ...t, ...style }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
      {children}
    </span>
  );
}
