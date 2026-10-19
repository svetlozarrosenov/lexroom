import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, MoreThanOrEqual, Repository } from 'typeorm';
import { Review } from '../../reviews/entities/review.entity.js';
import { ReviewStatus } from '../../reviews/review-status.enum.js';
import { Plan, PLAN_MAX_REVIEWS } from '../entities/plan.entity.js';

/** The plan as clients see it: the allowance and how much of it this month has used. */
export type PlanUsage = {
  max: number;
  used: number;
  remaining: number;
};

/** First instant of the calendar month `now` falls in, in UTC. */
export function startOfMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(Plan)
    private readonly plans: Repository<Plan>,
  ) {}

  /**
   * The plan with this month's usage. "Used" counts completed reviews only: failed ones
   * never count, and a running one does not count until it completes.
   * Pass a transaction's manager to read inside that transaction.
   */
  async current(manager: EntityManager = this.plans.manager): Promise<PlanUsage> {
    const { max } = await this.plan(manager);
    const used = await this.usedThisMonth(manager);
    return { max, used, remaining: Math.max(0, max - used) };
  }

  /** Whether one more review may complete this month. */
  async hasAllowance(manager: EntityManager = this.plans.manager): Promise<boolean> {
    return (await this.current(manager)).remaining > 0;
  }

  /**
   * Marks a running review "completed" if the plan still has room this month, in ONE
   * statement: the UPDATE's condition counts this month's completed reviews itself. SQLite
   * runs a statement atomically, so two reviews finishing at the same time cannot both
   * take the last slot, and no transaction is needed (with one connection, two overlapping
   * transactions would interleave). Returns false when nothing was updated: the review is
   * no longer running, or the plan is used up. The caller tells the two apart.
   */
  async completeWithinPlan(reviewId: string): Promise<boolean> {
    const { max } = await this.plan(this.plans.manager);
    const { affected } = await this.plans.manager
      .createQueryBuilder()
      .update(Review)
      .set({ status: ReviewStatus.Completed })
      .where('id = :id AND status = :running', { id: reviewId, running: ReviewStatus.Running })
      .andWhere(
        '(SELECT COUNT(*) FROM reviews WHERE status = :completed AND "createdAt" >= :since) < :max',
        { completed: ReviewStatus.Completed, since: startOfMonth(), max },
      )
      .execute();
    return (affected ?? 0) > 0;
  }

  /** Completed reviews created since the 1st of the current month. */
  usedThisMonth(manager: EntityManager = this.plans.manager): Promise<number> {
    return manager.getRepository(Review).countBy({
      status: ReviewStatus.Completed,
      createdAt: MoreThanOrEqual(startOfMonth()),
    });
  }

  /** Deletes the plan row; it is recreated with the default allowance on next use. */
  async removeAll(): Promise<void> {
    await this.plans.clear();
  }

  /** The single plan row, created with the default allowance on first use. */
  private async plan(manager: EntityManager): Promise<Plan> {
    const repo = manager.getRepository(Plan);
    const plan = await repo.findOneBy({});
    if (plan) return plan;
    return repo.save(repo.create({ max: PLAN_MAX_REVIEWS }));
  }
}
