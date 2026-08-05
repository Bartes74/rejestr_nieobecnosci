import * as React from 'react';
export interface SelectOption { value: string; label: string; }
export interface SelectProps {
  label?: React.ReactNode;
  value: string;
  options: (string | SelectOption)[];
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
}
export function Select(props: SelectProps): React.JSX.Element;
