import React from 'react';
export function Tabs({ tabs, value, onChange, style }) {
  return (
    <div style={{ display: 'flex', gap: 18, borderBottom: '1px solid var(--border)', ...style }}>
      {tabs.map((t) => {
        const val = typeof t === 'string' ? t : t.value;
        const lbl = typeof t === 'string' ? t : t.label;
        const active = val === value;
        return (
          <button key={val} onClick={() => onChange && onChange(val)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '11px 0', fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: active ? 700 : 600, color: active ? 'var(--brand)' : 'var(--muted)', borderBottom: '2px solid ' + (active ? 'var(--brand)' : 'transparent'), marginBottom: -1 }}>{lbl}</button>
        );
      })}
    </div>
  );
}
