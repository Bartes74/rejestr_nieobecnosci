import * as React from 'react';
export interface TooltipProps {
  label: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Tooltip(props: TooltipProps): React.JSX.Element;
