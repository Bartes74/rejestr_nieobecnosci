import * as React from 'react';
export interface AbsencePillProps {
  /** Date or range, e.g. "23–27.06". */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function AbsencePill(props: AbsencePillProps): React.JSX.Element;
