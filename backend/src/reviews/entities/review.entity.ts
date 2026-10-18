import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ReviewStatus } from '../review-status.enum.js';
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
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Document from samples/documents.json */
  @Column({ type: 'text' })
  documentId: string;

  /** Lawyer from samples/lawyers.json who requested the review */
  @Column({ type: 'text' })
  lawyerId: string;

  @Column({ type: 'text', default: ReviewStatus.Running })
  status: ReviewStatus;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Finding, (finding) => finding.review)
  findings: Finding[];
}
