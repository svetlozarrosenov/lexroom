import type { ReviewStatus } from './review-status.enum.js';

/** Something changed on a review; clients refetch, the event carries no findings. */
export type ReviewEvent =
  | { type: 'status'; documentId: string; reviewId: string; status: ReviewStatus }
  | { type: 'finding'; documentId: string; reviewId: string };
