import * as React from 'react';
export interface ToastProps {
  tone?: 'brand' | 'amber' | 'danger' | 'info';
  icon?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
  onClose?: () => void;
  style?: React.CSSProperties;
}
export function Toast(props: ToastProps): React.JSX.Element;
