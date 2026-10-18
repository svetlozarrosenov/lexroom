import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Plan, PLAN_MAX_REVIEWS } from '../entities/plan.entity.js';

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(Plan)
    private readonly plans: Repository<Plan>,
  ) {}

  /** The workspace plan, created with a full allowance on first use. */
  async current(manager: EntityManager = this.plans.manager): Promise<Plan> {
    const repo = manager.getRepository(Plan);
    const plan = await repo.findOneBy({});
    if (plan) return plan;
    return repo.save(repo.create({ max: PLAN_MAX_REVIEWS, remaining: PLAN_MAX_REVIEWS }));
  }

  /** Deletes the plan; it is recreated with a full allowance on next use. */
  async removeAll(): Promise<void> {
    await this.plans.clear();
  }

  /**
   * Takes one review from the plan. Atomic: the decrement is a single UPDATE guarded by
   * `remaining > 0`, so two concurrent reviews can never both take the last one.
   * Returns false, without changing anything, when the plan is used up.
   * Pass the transaction's manager to make it part of a larger unit of work.
   */
  async consume(manager: EntityManager = this.plans.manager): Promise<boolean> {
    const plan = await this.current(manager);
    const result = await manager
      .createQueryBuilder()
      .update(Plan)
      .set({ remaining: () => 'remaining - 1' })
      .where('id = :id AND remaining > 0', { id: plan.id })
      .execute();
    return (result.affected ?? 0) > 0;
  }
}
