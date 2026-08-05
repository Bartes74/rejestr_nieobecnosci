import * as React from 'react';
export interface CardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned header slot (e.g. a Button or link). */
  right?: React.ReactNode;
  /** Inner padding in px. */
  padding?: number;
  /** Use the smaller (14px) radius for nested cards. */
  inset?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
/**
 * @startingPoint section="Core" subtitle="Surface card with optional header" viewport="700x220"
 */
export function Card(props: CardProps): React.JSX.Element;
