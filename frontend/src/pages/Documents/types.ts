import type { Column } from '../../components/Table';
import type { ReviewStatus } from '../../components/Reviews/types';

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
  latestReview: LatestReview | null;
};

export type DocumentColumn = Column<Document>;
