import type { Finding, Severity } from '../../pages/Documents/types';

export type { Finding, Severity };

export type FindingsProps = {
  findings: Finding[];
  emptyMessage?: string;
};
