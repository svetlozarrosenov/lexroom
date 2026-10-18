import { ConflictException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { AI_PROVIDER } from '../../ai/interfaces/ai-provider.interface.js';
import type { AiProvider } from '../../ai/interfaces/ai-provider.interface.js';
import { PlanService } from '../../plan/services/plan.service.js';
import { Finding } from '../../findings/entities/finding.entity.js';
import { ONE_RUNNING_REVIEW_PER_DOCUMENT, Review } from '../entities/review.entity.js';
import { ReviewStatus } from '../review-status.enum.js';
import type { CreateReviewDto } from '../dto/create-review.dto.js';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviews: Repository<Review>,
    private readonly dataSource: DataSource,
    private readonly plan: PlanService,
    @Inject(AI_PROVIDER)
    private readonly ai: AiProvider,
  ) {}

  /** Reviews with their findings, newest first, optionally only those of one document. */
  findAll(documentId?: string): Promise<Review[]> {
    return this.reviews.find({
      where: documentId ? { documentId } : {},
      relations: { findings: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** Deletes every review and, through the cascade, every finding. */
  async removeAll(): Promise<void> {
    await this.reviews.clear();
  }

  /**
   * Starts a review for a document:
   * 1. the review row is created as "running" (the partial unique index rejects a second
   *    running review of the same document: 409);
   * 2. in one transaction, the AI's findings are stored, one review is taken from the plan
   *    and the review is marked "completed";
   * 3. any failure in step 2 rolls that transaction back and marks the review "failed",
   *    so it never consumes the plan and the document is free for a retry.
   */
  async start(dto: CreateReviewDto): Promise<Review> {
    const review = await this.createRunning(dto);

    try {
      await this.dataSource.transaction(async (manager) => {
        for await (const content of this.ai.review(review.documentId)) {
          await manager.save(manager.create(Finding, { reviewId: review.id, content }));
        }

        if (!(await this.plan.consume(manager))) {
          throw new HttpException('No reviews left in the plan', HttpStatus.PAYMENT_REQUIRED);
        }

        await manager.update(Review, review.id, { status: ReviewStatus.Completed });
      });
    } catch (error) {
      await this.reviews.update(review.id, { status: ReviewStatus.Failed });
      throw error;
    }

    return this.reviews.findOneOrFail({ where: { id: review.id }, relations: { findings: true } });
  }

  /**
   * The "one running review per document" rule is not checked with a SELECT first: that
   * would race between two lawyers clicking at the same time. We INSERT and let the
   * partial unique index decide.
   */
  private async createRunning(dto: CreateReviewDto): Promise<Review> {
    try {
      return await this.reviews.save(
        this.reviews.create({
          documentId: dto.documentId,
          lawyerId: dto.lawyerId,
          status: ReviewStatus.Running,
        }),
      );
    } catch (error) {
      if (isRunningReviewConflict(error)) {
        throw new ConflictException('A review of this document is already in progress');
      }
      throw error;
    }
  }
}

function isRunningReviewConflict(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    /UNIQUE constraint failed/i.test(error.message) &&
    // SQLite names the index in the message only for some versions; the column is always there.
    (error.message.includes(ONE_RUNNING_REVIEW_PER_DOCUMENT) || error.message.includes('documentId'))
  );
}
