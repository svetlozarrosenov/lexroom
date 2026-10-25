import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan, PLAN_MAX_REVIEWS } from '../entities/plan.entity.js';

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(Plan)
    private readonly plans: Repository<Plan>,
  ) {}

  /** The monthly allowance, from the single plan row (created with the default on first use). */
  async max(): Promise<number> {
    const plan = await this.plans.findOneBy({});
    if (plan) return plan.max;
    return (await this.plans.save(this.plans.create({ max: PLAN_MAX_REVIEWS })))
      .max;
  }

  /** Deletes the plan row; it is recreated with the default allowance on next use. */
  async removeAll(): Promise<void> {
    await this.plans.clear();
  }
}
