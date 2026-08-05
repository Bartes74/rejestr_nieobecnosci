import * as React from 'react';
export interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  sub?: React.ReactNode;
  /** Accent colour for the figure (e.g. var(--amber) for at-risk). */
  accent?: string;
  style?: React.CSSProperties;
}
/**
 * @startingPoint section="Data" subtitle="Big-figure metric card" viewport="380x150"
 */
export function StatCard(props: StatCardProps): React.JSX.Element;
