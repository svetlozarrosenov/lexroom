import { Controller, Get } from '@nestjs/common';
import { PlanService } from '../services/plan.service.js';

@Controller('plan')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  /** `{ max }`: the monthly allowance. What is used comes from GET /reviews/used. */
  @Get()
  async current() {
    return { max: await this.planService.max() };
  }
}
