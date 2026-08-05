import * as React from 'react';
export interface NavItemProps {
  icon?: React.ReactNode;
  label: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export function NavItem(props: NavItemProps): React.JSX.Element;
