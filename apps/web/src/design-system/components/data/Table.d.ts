import * as React from 'react';
export interface TableColumn { key: string; label: React.ReactNode; width?: string; align?: 'left' | 'right' | 'center'; mono?: boolean; bold?: boolean; }
export interface TableProps {
  columns: TableColumn[];
  /** Row objects keyed by column.key; values may be nodes (Badge, AbsencePill, etc). */
  rows: Record<string, React.ReactNode>[];
  style?: React.CSSProperties;
}
export function Table(props: TableProps): React.JSX.Element;
