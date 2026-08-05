import React from 'react';
export function Tooltip({ label, children, style }) {
  const [show, setShow] = React.useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', ...style }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{ position: 'absolute', bottom: 'calc(100% + 7px)', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', zIndex: 50, background: 'var(--ink)', color: 'var(--surface)', fontSize: 11.5, fontWeight: 500, padding: '5px 9px', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow)' }}>{label}</span>
      )}
    </span>
  );
}
