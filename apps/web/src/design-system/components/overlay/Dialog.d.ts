import * as React from 'react';
export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Footer slot — typically Buttons. */
  footer?: React.ReactNode;
  width?: number;
  /** Element to focus when the dialog opens; defaults to the first focusable node. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}
export function Dialog(props: DialogProps): React.JSX.Element | null;
