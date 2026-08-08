import React from 'react';

const SIZES = {
  sm: { padding: '8px 13px', fontSize: 12.5 },
  md: { padding: '11px 16px', fontSize: 13.5 },
  lg: { padding: '13px 22px', fontSize: 14.5 },
};
const VARIANTS = {
  primary:   { background: 'var(--brand)', color: 'var(--on-brand)', border: '1px solid var(--brand)', boxShadow: 'var(--shadow-sm)' },
  secondary: { background: 'var(--surface)', color: 'var(--ink-2)', border: '1px solid var(--border-2)' },
  ghost:     { background: 'transparent', color: 'var(--brand)', border: '1px solid transparent' },
  tint:      { background: 'var(--brand-tint)', color: 'var(--brand)', border: '1px solid var(--brand)' },
  danger:    { background: 'var(--danger)', color: 'var(--on-danger)', border: '1px solid var(--danger)' },
};

export function Button({ variant = 'primary', size = 'md', icon, children, disabled = false, onClick, type = 'button', style, ...rest }) {
  const s = SIZES[size] || SIZES.md;
  const v = VARIANTS[variant] || VARIANTS.primary;
  return (
    <button type={type} disabled={disabled} onClick={disabled ? undefined : onClick}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        fontFamily: 'var(--font-sans)', fontWeight: 700, lineHeight: 1, borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, transition: 'background .14s, opacity .14s',
        ...s, ...v, ...style }} {...rest}>
      {icon}{children}
    </button>
  );
}
