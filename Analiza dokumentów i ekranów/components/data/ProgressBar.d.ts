import * as React from 'react';
export interface ProgressSegment { pct: number; color?: string; }
export interface ProgressBarProps {
  /** Single-segment percentage (0–100). */
  value?: number;
  color?: string;
  /** Multi-segment fill, e.g. used vs. carried-over leave. */
  segments?: ProgressSegment[];
  height?: number;
  style?: React.CSSProperties;
}
export function ProgressBar(props: ProgressBarProps): React.JSX.Element;
