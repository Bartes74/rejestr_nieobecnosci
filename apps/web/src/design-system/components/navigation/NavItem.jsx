import React from 'react';

export function NavItem({ icon, label, active = false, onClick, style }) {
  return (
    <a onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', margin: '1px 0',
      borderRadius: 'var(--radius-sm)', cursor: 'pointer', textDecoration: 'none', fontFamily: 'var(--font-sans)',
      fontWeight: 600, fontSize: 13.5, color: active ? 'var(--brand)' : 'var(--ink-2)',
      background: active ? 'var(--brand-tint)' : 'transparent', ...style }}>
      {icon}{label}
    </a>
  );
}
