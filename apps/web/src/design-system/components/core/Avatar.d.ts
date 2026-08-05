import * as React from 'react';
export interface AvatarProps {
  /** 2-letter initials. */
  initials: string;
  tone?: 'brand' | 'blue' | 'neutral';
  /** Square size in px (rounded-square, not circle). */
  size?: number;
  style?: React.CSSProperties;
}
export function Avatar(props: AvatarProps): React.JSX.Element;
