import * as React from 'react';
export interface InputProps {
  label?: React.ReactNode;
  icon?: React.ReactNode;
  value?: string;
  placeholder?: string;
  type?: string;
  onChange?: (value: string) => void;
  hint?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Input(props: InputProps): React.JSX.Element;
