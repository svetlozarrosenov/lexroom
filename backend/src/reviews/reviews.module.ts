import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module.js';
import { Document } from '../documents/entities/document.entity.js';
import { FindingsModule } from '../findings/findings.module.js';
import { PlanModule } from '../plan/plan.module.js';
import { Review } from './entities/review.entity.js';
import { ReviewsController } from './controllers/reviews.controller.js';
import { ReviewEventsService } from './services/review-events.service.js';
import { ReviewsService } from './services/reviews.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Document]),
    AiModule,
    PlanModule,
    FindingsModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewEventsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
