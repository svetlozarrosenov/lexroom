import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { AiFinding } from '../../ai/interfaces/ai-provider.interface.js';
import { Review } from '../../reviews/entities/review.entity.js';

/** One finding returned by the AI for a review, stored as it came. */
@Entity('findings')
export class Finding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'text' })
  reviewId: string;

  @ManyToOne(() => Review, (review) => review.findings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewId' })
  // Relation<> keeps the circular import between the entity files out of the decorator metadata (ESM).
  review: Relation<Review>;

  @Column({ type: 'simple-json' })
  content: AiFinding;
}
