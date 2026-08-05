import React from 'react';
export function Select({ label, value, options, onChange, style }) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => (typeof o === 'string' ? o : o.value) === value);
  const curLabel = current ? (typeof current === 'string' ? current : current.label) : value;
  return (
    <div style={{ position: 'relative', ...style }}>
      {label && <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 7 }}>{label}</span>}
      <button onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: '1px solid var(--border-2)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '12px 14px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
        {curLabel}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow)', padding: 4 }}>
          {options.map((o) => {
            const val = typeof o === 'string' ? o : o.value;
            const lbl = typeof o === 'string' ? o : o.label;
            const active = val === value;
            return <div key={val} onClick={() => { onChange && onChange(val); setOpen(false); }} style={{ padding: '9px 11px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13.5, fontWeight: active ? 600 : 400, color: active ? 'var(--brand)' : 'var(--ink-2)', background: active ? 'var(--brand-tint)' : 'transparent' }}>{lbl}</div>;
          })}
        </div>
      )}
    </div>
  );
}
