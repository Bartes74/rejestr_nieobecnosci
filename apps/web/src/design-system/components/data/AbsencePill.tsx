import type { CSSProperties, ReactNode } from 'react';

export interface AbsencePillProps {
  /** Data albo zakres, np. „23–27.06". */
  children?: ReactNode;
  style?: CSSProperties;
}

export function AbsencePill({ children, style }: AbsencePillProps) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 12,
      color: 'var(--absence-ink)', background: 'var(--absence)', border: '1px solid var(--absence-border)',
      padding: '3px 9px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap', ...style }}>
      {children}
    </span>
  );
}
