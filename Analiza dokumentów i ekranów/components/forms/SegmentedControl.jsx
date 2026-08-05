import React from 'react';

export function SegmentedControl({ options, value, onChange, style }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: 3, ...style }}>
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        const active = val === value;
        return (
          <button key={val} onClick={() => onChange && onChange(val)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12.5, padding: '6px 13px', borderRadius: 'var(--radius-sm)',
              color: active ? 'var(--brand)' : 'var(--muted)', background: active ? 'var(--surface)' : 'transparent',
              boxShadow: active ? 'var(--shadow-sm)' : 'none' }}>
            {typeof o !== 'string' && o.icon}{label}
          </button>
        );
      })}
    </div>
  );
}
