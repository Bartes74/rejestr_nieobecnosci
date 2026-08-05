import React from 'react';
export function Input({ label, icon, value, placeholder, type = 'text', onChange, hint, style }) {
  return (
    <label style={{ display: 'block', ...style }}>
      {label && <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 7 }}>{label}</span>}
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border-2)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
        {icon && <span style={{ display: 'flex', color: 'var(--muted)', flex: 'none' }}>{icon}</span>}
        <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange && onChange(e.target.value)}
          style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, minWidth: 0, fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--ink)' }} />
      </span>
      {hint && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>{hint}</span>}
    </label>
  );
}
