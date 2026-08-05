import React from 'react';

export function Card({ title, subtitle, right, padding = 22, inset = false, children, style }) {
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: inset ? 'var(--radius-lg)' : 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden', ...style }}>
      {(title || right) && (
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: padding + 'px ' + padding + 'px ' + (subtitle ? 12 : 14) + 'px' }}>
          <div>
            {title && <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          {right}
        </header>
      )}
      <div style={{ padding: (title || right) ? '0 ' + padding + 'px ' + padding + 'px' : padding }}>
        {children}
      </div>
    </section>
  );
}
