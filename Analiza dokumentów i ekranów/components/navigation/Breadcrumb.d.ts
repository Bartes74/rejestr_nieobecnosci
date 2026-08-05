import * as React from 'react';
export interface CrumbItem { label: React.ReactNode; active?: boolean; onClick?: () => void; }
export interface BreadcrumbProps {
  /** Org-hierarchy drill path: pion › departament › Tribe › squad › osoba. */
  items: CrumbItem[];
  style?: React.CSSProperties;
}
export function Breadcrumb(props: BreadcrumbProps): React.JSX.Element;
