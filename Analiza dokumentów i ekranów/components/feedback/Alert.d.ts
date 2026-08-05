import * as React from 'react';
export interface AlertProps {
  variant?: 'info' | 'brand' | 'amber' | 'danger';
  icon?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Right-aligned slot. */
  right?: React.ReactNode;
  /** Render icon in a filled tile (used for high-emphasis danger/brand notices). */
  solidIcon?: boolean;
  style?: React.CSSProperties;
}
/**
 * @startingPoint section="Feedback" subtitle="Tinted notice / alert banner" viewport="700x150"
 */
export function Alert(props: AlertProps): React.JSX.Element;
