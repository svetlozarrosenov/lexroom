import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, QueryFailedError, Repository } from 'typeorm';
import { AI_PROVIDER } from '../../ai/interfaces/ai-provider.interface.js';
import type { AiProvider } from '../../ai/interfaces/ai-provider.interface.js';
import { PlanService } from '../../plan/services/plan.service.js';
import { Document } from '../../documents/entities/document.entity.js';
import { Finding } from '../../findings/entities/finding.entity.js';
import {
  ONE_RUNNING_REVIEW_PER_DOCUMENT,
  Review,
} from '../entities/review.entity.js';
import { ReviewStatus } from '../review-status.enum.js';
import { ReviewEventsService } from './review-events.service.js';
import type { CreateReviewDto } from '../dto/create-review.dto.js';

/** The brief: a review still running 60 s after it was requested has failed, permanently. */
export const REVIEW_TIMEOUT_MS = 60_000;

/** First instant of the calendar month `now` falls in, in UTC. */
export function startOfMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

@Injectable()
export class ReviewsService implements OnModuleInit {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectRepository(Review)
    private readonly reviews: Repository<Review>,
    @InjectRepository(Finding)
    private readonly findings: Repository<Finding>,
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,
    private readonly plan: PlanService,
    private readonly events: ReviewEventsService,
    @Inject(AI_PROVIDER)
    private readonly ai: AiProvider,
  ) {}

  /**
   * A review left "running" by a previous process can never finish: its timer died with
   * the process, and the brief says a review still running after 60 s has failed for good.
   * Marking it failed on boot also frees its document, which the running row was blocking.
   */
  async onModuleInit(): Promise<void> {
    const { affected } = await this.reviews.update(
      { status: ReviewStatus.Running },
      { status: ReviewStatus.Failed },
    );
    if (affected)
      this.logger.warn(
        `${affected} review(s) left running by a previous process marked failed`,
      );
  }

  /** Every review in the workspace with its findings, newest first. */
  findAll(): Promise<Review[]> {
    return this.reviews.find({
      relations: { findings: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** The reviews of one document with their findings, newest first. */
  findAllByDocumentId(documentId: string): Promise<Review[]> {
    return this.reviews.find({
      where: { documentId },
      relations: { findings: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** One review with its findings, or null if unknown. */
  findOne(id: string): Promise<Review | null> {
    return this.reviews.findOne({
      where: { id },
      relations: { findings: true },
    });
  }

  /**
   * Reviews counted against the plan this month: the completed ones created since the 1st
   * (UTC). Failed ones never count, a running one not until it completes. Nothing is stored,
   * so the allowance renews itself on the 1st without any scheduled job.
   */
  usedThisMonth(): Promise<number> {
    return this.reviews.countBy({
      status: ReviewStatus.Completed,
      createdAt: MoreThanOrEqual(startOfMonth()),
    });
  }

  /** Deletes every review and, through the cascade, every finding. */
  async removeAll(): Promise<void> {
    await this.reviews.clear();
  }

  /**
   * Requests a review:
   * - with no reviews left in the plan this month, nothing is created: 402. The request is
   *   not queued (nothing may look like a review on its way) but it is remembered on the
   *   document as a reminder to run it next month. This is the early, user-facing check;
   *   the binding one is repeated when the review completes, because reviews started in
   *   parallel all pass here;
   * - otherwise the review is created as "running" (the partial unique index rejects a
   *   second running review of the same document: 409) and returned at once. The work
   *   itself continues in the background, see `run`; clients follow it through the events
   *   stream;
   * - an unknown document is refused by the foreign key: 404.
   */
  async start(dto: CreateReviewDto): Promise<Review> {
    if ((await this.usedThisMonth()) >= (await this.plan.max())) {
      await this.documents.update(
        { id: dto.documentId },
        { reviewRequestedAt: new Date() },
      );
      throw new HttpException(
        'No reviews left in the plan this month',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const review = await this.createRunning(dto);
    this.emitStatus(review, ReviewStatus.Running);

    this.run(review).catch((error: unknown) => {
      this.logger.error(`Review ${review.id} crashed: ${String(error)}`);
    });

    return review;
  }

  /**
   * The life of one review after it was created, outside any transaction:
   * - every finding the AI returns is stored (and announced) on its own, so whatever came
   *   in before a failure stays visible;
   * - at the end, the review is marked "completed" if the plan still has room this month
   *   (a completed review is what uses the plan); an AI error marks it "failed";
   * - a timer cuts the AI off 60 s after the review was requested (see `timeOut`).
   * Every status change is guarded by `status = 'running'`, so whichever of completion
   * and timeout comes first wins and the other one does nothing.
   */
  private async run(review: Review): Promise<void> {
    const { id: reviewId, documentId } = review;
    const controller = new AbortController();
    const timeLeft = Math.max(
      0,
      review.createdAt.getTime() + REVIEW_TIMEOUT_MS - Date.now(),
    );
    const timer = setTimeout(() => {
      this.timeOut(review, controller).catch((error: unknown) => {
        this.logger.error(
          `Review ${reviewId} could not be timed out: ${String(error)}`,
        );
      });
    }, timeLeft);

    try {
      for await (const content of this.ai.review(
        documentId,
        controller.signal,
      )) {
        // A finding that arrives after the timeout belongs to a review that already failed.
        if (controller.signal.aborted) break;
        await this.findings.save(this.findings.create({ reviewId, content }));
        this.events.emit({ type: 'finding', documentId, reviewId });
      }
      if (controller.signal.aborted) return;
      await this.complete(review);
    } catch (error) {
      // A real provider rejects with AbortError once we cut it off; the review failed already.
      if (controller.signal.aborted) return;
      this.logger.warn(`Review ${reviewId} failed: ${String(error)}`);
      await this.fail(review);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Marks the review "completed" if the plan still has room this month, in ONE statement:
   * the UPDATE's condition counts this month's completed reviews itself. SQLite runs a
   * statement atomically, so two reviews finishing at the same time cannot both take the
   * last slot, and no transaction is needed (with one connection, two overlapping
   * transactions would interleave). When nothing was updated, either the timeout got there
   * first (the row is no longer running: the completion is dropped) or the plan is used up
   * (the row is still running: the review fails).
   */
  private async complete(review: Review): Promise<void> {
    const max = await this.plan.max();
    const { affected } = await this.reviews
      .createQueryBuilder()
      .update()
      .set({ status: ReviewStatus.Completed })
      .where('id = :id AND status = :running', {
        id: review.id,
        running: ReviewStatus.Running,
      })
      .andWhere(
        '(SELECT COUNT(*) FROM reviews WHERE status = :completed AND "createdAt" >= :since) < :max',
        {
          completed: ReviewStatus.Completed,
          since: startOfMonth(),
          max,
        },
      )
      .execute();

    if (affected) {
      // A completed review settles any "run it next month" reminder left on the document.
      await this.documents.update(
        { id: review.documentId },
        { reviewRequestedAt: null },
      );
      this.emitStatus(review, ReviewStatus.Completed);
      return;
    }

    const current = await this.reviews.findOneBy({ id: review.id });
    if (current?.status === ReviewStatus.Running) {
      this.logger.warn(
        `Review ${review.id} failed: no reviews left in the plan`,
      );
      await this.fail(review);
    }
  }

  /**
   * Timer callback. Aborting the signal is what actually stops the AI: a real provider
   * closes its connection to the model, the fake clears the timer it was sleeping on.
   * Then the review is marked "failed", which never counts against the plan.
   */
  private async timeOut(
    review: Review,
    controller: AbortController,
  ): Promise<void> {
    controller.abort();
    await this.fail(review);
  }

  /** Marks a still-running review "failed"; a no-op if it already ended. */
  private async fail(review: Review): Promise<void> {
    const { affected } = await this.reviews.update(
      { id: review.id, status: ReviewStatus.Running },
      { status: ReviewStatus.Failed },
    );
    if (affected) this.emitStatus(review, ReviewStatus.Failed);
  }

  private emitStatus(review: Review, status: ReviewStatus): void {
    this.events.emit({
      type: 'status',
      documentId: review.documentId,
      reviewId: review.id,
      status,
    });
  }

  /**
   * The "one running review per document" rule is not checked with a SELECT first: that
   * would race between two lawyers clicking at the same time. We INSERT and let the
   * partial unique index decide. The foreign key on documentId rejects unknown documents
   * the same way.
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
        throw new ConflictException(
          'A review of this document is already in progress',
        );
      }
      if (isUnknownDocument(error)) {
        throw new NotFoundException(`Unknown document ${dto.documentId}`);
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
    (error.message.includes(ONE_RUNNING_REVIEW_PER_DOCUMENT) ||
      error.message.includes('documentId'))
  );
}

function isUnknownDocument(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    /FOREIGN KEY constraint failed/i.test(error.message)
  );
}
