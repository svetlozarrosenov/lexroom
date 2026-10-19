import type { Finding, Severity } from '../../pages/Documents/types';

export type { Finding, Severity };

export type FindingsProps = {
  findings: Finding[];
  emptyMessage?: string;
  /** The review is still running: more findings may arrive, show a waiting row after the last one. */
  pending?: boolean;
};
