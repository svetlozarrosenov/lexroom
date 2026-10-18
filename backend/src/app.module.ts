import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AiModule } from './ai/ai.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { FindingsModule } from './findings/findings.module.js';
import { PlanModule } from './plan/plan.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DATABASE_PATH ?? 'data/lexroom.sqlite',
      autoLoadEntities: true,
      // Schema is created from the entities on startup. Fine for this exercise;
      // a real deployment would use migrations instead.
      synchronize: true,
    }),
    AiModule,
    DocumentsModule,
    FindingsModule,
    PlanModule,
    ReviewsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
