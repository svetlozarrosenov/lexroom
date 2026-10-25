import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { Review } from '../../reviews/entities/review.entity.js';

/** A document of the workspace, seeded from samples/documents.json. */
@Entity('documents')
export class Document {
  /** Id from samples/documents.json, kept as is so the samples stay the source of truth. */
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  type: string;

  @Column({ type: 'integer' })
  pages: number;

  @Column({ type: 'text' })
  uploadedAt: string;

  /** Lawyer from samples/lawyers.json */
  @Column({ type: 'text' })
  uploadedBy: string;

  /** Id of the document this one replaces, if any (a newer version of the same contract). */
  @Column({ type: 'text', nullable: true })
  supersedes: string | null;

  /**
   * When a lawyer asked for a review while the monthly plan was used up. A reminder for
   * next month, not a queued review: nothing starts by itself. Cleared when a review of
   * this document completes.
   */
  @Column({ type: 'datetime', nullable: true })
  reviewRequestedAt: Date | null;

  /**
   * The newest review of this document, or null. Not a column: DocumentsService joins it
   * (reviews.documentId is a foreign key to this table) in the same query as the document.
   */
  latestReview: Review | null;
}
