import React from 'react';

export function AbsencePill({ children, style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 12,
      color: 'var(--absence-ink)', background: 'var(--absence)', border: '1px solid var(--absence-border)',
      padding: '3px 9px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap', ...style }}>
      {children}
    </span>
  );
}
