import React from 'react';
export function Breadcrumb({ items, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, ...style }}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={it.active ? 'var(--muted)' : 'var(--border-2)'} strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>}
          <span onClick={it.onClick} style={{ cursor: it.onClick ? 'pointer' : 'default', fontWeight: it.active ? 700 : 400, color: it.active ? 'var(--brand)' : 'var(--muted)' }}>{it.label}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
