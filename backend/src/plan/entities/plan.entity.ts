import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Reviews included in the workspace plan per calendar month. */
export const PLAN_MAX_REVIEWS = 10;

/**
 * The workspace plan: a single row holding only the monthly allowance. What has been used
 * is not stored: it is the number of completed reviews created in the current calendar
 * month, so the allowance renews itself on the 1st without any scheduled job.
 */
@Entity('plan')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer', default: PLAN_MAX_REVIEWS })
  max: number;
}
