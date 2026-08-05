import React from 'react';
const TONES = { brand: 'var(--brand)', amber: 'var(--amber)', danger: 'var(--danger)', info: 'var(--blue)' };
export function Toast({ tone = 'brand', icon, title, children, onClose, style }) {
  return (
    <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', padding: '13px 14px', minWidth: 280, maxWidth: 380, ...style }}>
      <span style={{ flex: 'none', width: 32, height: 32, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, ' + TONES[tone] + ' 16%, transparent)', color: TONES[tone] }}>{icon}</span>
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 2 }}>{title}</div>}
        <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>{children}</div>
      </div>
      {onClose && <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>}
    </div>
  );
}
