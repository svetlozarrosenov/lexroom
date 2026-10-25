import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  VirtualColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ReviewStatus } from '../review-status.enum.js';
import { Document } from '../../documents/entities/document.entity.js';
import { Finding } from '../../findings/entities/finding.entity.js';

/**
 * At most one review per document may be "running" at any time, whoever requested it.
 * Enforced by the database: a partial unique index on documentId limited to running rows.
 * Any status other than "running" is unaffected, so a document can accumulate many
 * completed/failed reviews over time.
 */
export const ONE_RUNNING_REVIEW_PER_DOCUMENT = 'uq_review_running_per_document';

@Entity('reviews')
@Index(ONE_RUNNING_REVIEW_PER_DOCUMENT, ['documentId'], {
  unique: true,
  where: `status = '${ReviewStatus.Running}'`,
})
/** Serves the plan's "completed reviews this month" count. */
@Index('idx_review_status_created_at', ['status', 'createdAt'])
/**
 * Serves "reviews of one document, newest first". The unique index above cannot: it is
 * partial and only holds running rows.
 */
@Index('idx_review_document_created_at', ['documentId', 'createdAt'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Document from samples/documents.json; a foreign key, so a review of an unknown document cannot be created. */
  @Column({ type: 'text' })
  documentId: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Relation<Document>;

  /** Lawyer from samples/lawyers.json who requested the review */
  @Column({ type: 'text' })
  lawyerId: string;

  @Column({ type: 'text', default: ReviewStatus.Running })
  status: ReviewStatus;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Finding, (finding) => finding.review)
  findings: Relation<Finding[]>;

  /** Number of findings, counted by the database on every select, without loading them. */
  @VirtualColumn({
    type: 'integer',
    query: (alias) =>
      `SELECT COUNT(*) FROM findings WHERE "reviewId" = ${alias}.id`,
  })
  findingsCount: number;
}
