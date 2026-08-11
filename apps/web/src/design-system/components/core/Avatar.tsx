import type { CSSProperties } from 'react';

export interface AvatarProps {
  /** Inicjały, dwie litery. */
  initials: string;
  tone?: 'brand' | 'blue' | 'neutral';
  /** Bok w px — kwadrat z zaokrągleniem, nie koło. */
  size?: number;
  style?: CSSProperties;
}

const TONES: Record<NonNullable<AvatarProps['tone']>, CSSProperties> = {
  brand:   { color: 'var(--brand)', background: 'var(--brand-tint)' },
  blue:    { color: 'var(--blue)', background: 'var(--blue-tint)' },
  neutral: { color: 'var(--ink-2)', background: 'var(--surface-3)' },
};

export function Avatar({ initials, tone = 'brand', size = 32, style }: AvatarProps) {
  const t = TONES[tone] ?? TONES.brand;
  return (
    <span style={{ width: size, height: size, flex: 'none', borderRadius: Math.round(size * 0.26),
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)',
      fontWeight: 700, fontSize: Math.round(size * 0.38), ...t, ...style }}>
      {initials}
    </span>
  );
}
