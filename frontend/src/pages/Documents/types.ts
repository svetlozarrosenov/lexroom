import type { Column } from '../../components/Table';
import type { ReviewEvent, ReviewStatus } from '../../components/Reviews/types';

export type { ReviewEvent };

export type Severity = 'high' | 'medium' | 'low';

export type Finding = {
  clause: string | null;
  title: string;
  severity: Severity;
  excerpt: string | null;
  explanation: string;
};

export type LatestReview = {
  id: string;
  status: ReviewStatus;
  lawyerId: string;
  createdAt: string;
  findingsCount: number;
};

export type Document = {
  id: string;
  title: string;
  type: string;
  pages: number;
  uploadedAt: string;
  uploadedBy: string;
  supersedes: string | null;
  /** Set when a review was asked for while the plan was used up; a reminder, not a queue. */
  reviewRequestedAt: string | null;
  latestReview: LatestReview | null;
};

export type DocumentColumn = Column<Document>;
