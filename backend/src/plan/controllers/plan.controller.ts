import { Controller, Delete, Get, HttpCode } from '@nestjs/common';
import { PlanService } from '../services/plan.service.js';

@Controller('plan')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  current() {
    return this.planService.current();
  }

  @Delete()
  @HttpCode(204)
  removeAll() {
    return this.planService.removeAll();
  }
}
