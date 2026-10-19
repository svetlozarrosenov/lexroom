import type { ReactNode } from 'react';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

export type TableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  /** Classes for a row that needs to stand out; replaces the default hover shade. */
  rowClassName?: (row: T) => string | undefined;
  /** Native tooltip for a row. */
  rowTitle?: (row: T) => string | undefined;
};
