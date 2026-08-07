import React from 'react';

const VARIANTS = {
  info:   { border: 'var(--border)', bg: 'var(--surface-2)', fg: 'var(--blue)' },
  brand:  { border: 'var(--absence-border)', bg: 'var(--brand-tint)', fg: 'var(--brand)' },
  amber:  { border: 'var(--amber)', bg: 'var(--amber-tint)', fg: 'var(--amber)' },
  danger: { border: 'var(--danger)', bg: 'var(--danger-tint)', fg: 'var(--danger)' },
};

export function Alert({ variant = 'info', icon, title, children, right, solidIcon = false, style }) {
  const v = VARIANTS[variant] || VARIANTS.info;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: v.bg, border: '1px solid ' + v.border,
      borderRadius: 'var(--radius-xl)', padding: '16px 18px', ...style }}>
      {icon && (
        <span style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          ...(solidIcon ? { width: 34, height: 34, borderRadius: 'var(--radius-md)', background: v.fg, color: 'var(--on-brand)' } : { color: v.fg, marginTop: 1 }) }}>
          {icon}
        </span>
      )}
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 3 }}>{title}</div>}
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)' }}>{children}</div>
      </div>
      {right}
    </div>
  );
}
