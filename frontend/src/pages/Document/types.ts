import type { Document as DocumentListItem } from '../Documents/types';

/** A single document as returned by GET /documents/:id (no latest-review summary). */
export type Document = Omit<DocumentListItem, 'latestReview'>;

export type DocumentProps = {
  currentLawyerId: string;
};
