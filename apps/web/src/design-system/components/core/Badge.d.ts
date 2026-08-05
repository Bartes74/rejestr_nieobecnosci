import * as React from 'react';
export interface BadgeProps {
  /** Semantic tone. Use blue for neutral data tags, amber/danger for status. */
  tone?: 'neutral' | 'brand' | 'blue' | 'amber' | 'danger';
  /** Use IBM Plex Mono — for codes, sprint IDs, periods. */
  mono?: boolean;
  /** Leading status dot. */
  dot?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Badge(props: BadgeProps): React.JSX.Element;
