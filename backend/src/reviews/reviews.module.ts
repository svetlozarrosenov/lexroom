import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module.js';
import { FindingsModule } from '../findings/findings.module.js';
import { PlanModule } from '../plan/plan.module.js';
import { Review } from './entities/review.entity.js';
import { ReviewsController } from './controllers/reviews.controller.js';
import { ReviewsService } from './services/reviews.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Review]), AiModule, PlanModule, FindingsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
