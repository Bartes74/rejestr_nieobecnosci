import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

/**
 * Rozszerza atrybuty `<button>`, bo implementacja rozkłada `...rest` na element i zawsze to
 * robiła — sidecar `.d.ts` tego nie deklarował, więc typy zabraniały tego, co kod przyjmował
 * (np. `aria-label` czy `title`). Opis idzie teraz za zachowaniem, nie obok niego.
 */
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Waga wizualna. `primary` dla działania głównego — jedno na widok. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'tint' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /** Ikona wiodąca (SVG w stylu Lucide, 14–16 px). */
  icon?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
}

const SIZES: Record<NonNullable<ButtonProps['size']>, CSSProperties> = {
  sm: { padding: '8px 13px', fontSize: 12.5 },
  md: { padding: '11px 16px', fontSize: 13.5 },
  lg: { padding: '13px 22px', fontSize: 14.5 },
};
const VARIANTS: Record<NonNullable<ButtonProps['variant']>, CSSProperties> = {
  primary:   { background: 'var(--brand)', color: 'var(--on-brand)', border: '1px solid var(--brand)', boxShadow: 'var(--shadow-sm)' },
  secondary: { background: 'var(--surface)', color: 'var(--ink-2)', border: '1px solid var(--border-2)' },
  ghost:     { background: 'transparent', color: 'var(--brand)', border: '1px solid transparent' },
  tint:      { background: 'var(--brand-tint)', color: 'var(--brand)', border: '1px solid var(--brand)' },
  danger:    { background: 'var(--danger)', color: 'var(--on-danger)', border: '1px solid var(--danger)' },
};

/**
 * @startingPoint section="Core" subtitle="Branded button with 5 variants" viewport="700x150"
 */
export function Button({ variant = 'primary', size = 'md', icon, children, disabled = false, onClick, type = 'button', style, ...rest }: ButtonProps) {
  const s = SIZES[size] ?? SIZES.md;
  const v = VARIANTS[variant] ?? VARIANTS.primary;
  return (
    <button type={type} disabled={disabled} onClick={disabled ? undefined : onClick}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        fontFamily: 'var(--font-sans)', fontWeight: 700, lineHeight: 1, borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, transition: 'background .14s, opacity .14s',
        ...s, ...v, ...style }} {...rest}>
      {icon}{children}
    </button>
  );
}
