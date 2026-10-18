import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Reviews included in the workspace plan per calendar month. */
export const PLAN_MAX_REVIEWS = 10;

/** The workspace plan: a single row. A monthly cron resets `remaining` to `max`. */
@Entity('plan')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer', default: PLAN_MAX_REVIEWS })
  max: number;

  @Column({ type: 'integer', default: PLAN_MAX_REVIEWS })
  remaining: number;
}
