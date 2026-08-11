import type { CSSProperties } from 'react';

export interface ProgressSegment { pct: number; color?: string }

export interface ProgressBarProps {
  /** Wypełnienie jednosegmentowe (0–100). */
  value?: number;
  color?: string;
  /** Wypełnienie wielosegmentowe, np. wykorzystane vs zaległe dni. */
  segments?: ProgressSegment[];
  height?: number;
  style?: CSSProperties;
}

/**
 * Pasek wypełnienia — jedno- lub wielosegmentowy (np. wykorzystane vs zaległe dni).
 *
 * `aria-hidden` jest tu celowe: pasek w tej aplikacji zawsze stoi obok tej samej wartości
 * zapisanej tekstem („60 / 60 os-dni", „26 → 20"). Rola `progressbar` kazałaby czytnikowi
 * ekranu przeczytać tę liczbę drugi raz, nie wnosząc nic nowego.
 */
export function ProgressBar({ value, color = 'var(--brand)', segments, height = 11, style }: ProgressBarProps) {
  // `?? 0`, bo wariant jednosegmentowy bez `value` dawał wcześniej szerokość „undefined%",
  // czyli pasek pusty bez śladu w konsoli. Typ wymusił rozstrzygnięcie tego przypadku.
  const segs = segments ?? [{ pct: value ?? 0, color }];
  return (
    <div aria-hidden="true" style={{ display: 'flex', height, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--surface-3)', ...style }}>
      {segs.map((s, i) => (
        <div key={i} style={{ width: s.pct + '%', height: '100%', background: s.color || color }} />
      ))}
    </div>
  );
}
