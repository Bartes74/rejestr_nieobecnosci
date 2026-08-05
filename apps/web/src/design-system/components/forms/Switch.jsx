import React from 'react';

export function Switch({ checked = false, onChange, disabled = false, style }) {
  return (
    <button role="switch" aria-checked={checked} disabled={disabled} onClick={() => !disabled && onChange && onChange(!checked)}
      style={{ width: 34, height: 19, flex: 'none', borderRadius: 11, border: 'none', position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? 'var(--brand)' : 'var(--border-2)', transition: 'background .16s', opacity: disabled ? 0.5 : 1, ...style }}>
      <span style={{ position: 'absolute', top: 2, left: checked ? 17 : 2, width: 15, height: 15, borderRadius: '50%',
        background: '#fff', transition: 'left .16s', boxShadow: '0 1px 2px rgba(0,0,0,.25)' }} />
    </button>
  );
}
