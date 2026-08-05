import * as React from 'react';
export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Footer slot — typically Buttons. */
  footer?: React.ReactNode;
  width?: number;
}
export function Dialog(props: DialogProps): React.JSX.Element;
