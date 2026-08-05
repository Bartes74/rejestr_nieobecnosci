import React from 'react';
export function Table({ columns, rows, style }) {
  const template = columns.map((c) => c.width || '1fr').join(' ');
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', background: 'var(--surface)', ...style }}>
      <div style={{ display: 'grid', gridTemplateColumns: template, padding: '11px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', color: 'var(--muted)' }}>
        {columns.map((c, i) => <div key={i} style={{ textAlign: c.align || 'left' }}>{c.label}</div>)}
      </div>
      {rows.map((r, ri) => (
        <div key={ri} style={{ display: 'grid', gridTemplateColumns: template, padding: '13px 20px', alignItems: 'center', fontSize: 13, borderBottom: ri < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
          {columns.map((c, ci) => (
            <div key={ci} style={{ textAlign: c.align || 'left', fontFamily: c.mono ? 'var(--font-mono)' : 'var(--font-sans)', fontWeight: c.bold ? 600 : 400, color: ci === 0 ? 'var(--ink)' : 'var(--ink-2)' }}>{r[c.key]}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
