import * as React from 'react';
export interface SegmentOption { value: string; label: string; icon?: React.ReactNode; }
export interface SegmentedControlProps {
  /** Options as strings or {value,label,icon}. Keep to 2–4 short items. */
  options: (string | SegmentOption)[];
  value: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
}
export function SegmentedControl(props: SegmentedControlProps): React.JSX.Element;
