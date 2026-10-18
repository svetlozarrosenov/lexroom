import type { Finding as FindingContent } from '../../pages/Documents/types';

export type ReviewStatus = 'running' | 'completed' | 'failed';

export type ReviewFinding = {
  id: string;
  reviewId: string;
  content: FindingContent;
};

export type Review = {
  id: string;
  documentId: string;
  lawyerId: string;
  status: ReviewStatus;
  createdAt: string;
  findings?: ReviewFinding[];
};

export type StartReviewBody = {
  documentId: string;
  lawyerId: string;
};

export type ReviewsProps = {
  documentId: string;
  lawyerId: string;
};
