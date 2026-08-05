import * as React from 'react';
export interface ButtonProps {
  /** Visual style. Primary for the main action; one primary per view. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'tint' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /** Optional leading icon node (Lucide-style SVG, 14–16px). */
  icon?: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  style?: React.CSSProperties;
}
/**
 * @startingPoint section="Core" subtitle="Branded button with 5 variants" viewport="700x150"
 */
export function Button(props: ButtonProps): React.JSX.Element;
