import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ReviewEventsService } from '../services/review-events.service.js';
import { ReviewsService } from '../services/reviews.service.js';
import type { CreateReviewDto } from '../dto/create-review.dto.js';

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly reviewEvents: ReviewEventsService,
  ) {}

  @Get()
  findAll(@Query('documentId') documentId?: string) {
    return this.reviewsService.findAll(documentId);
  }

  /**
   * Server-Sent Events: one message per change on a review. With `documentId`, only that
   * document's reviews; without it, every review in the workspace (used by the list).
   */
  @Sse('events')
  events(@Query('documentId') documentId?: string): Observable<MessageEvent> {
    const events = documentId ? this.reviewEvents.forDocument(documentId) : this.reviewEvents.all();
    return events.pipe(map((event) => ({ data: event })));
  }

  /** Declared after the SSE route so that "events" is never read as an id. */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const review = await this.reviewsService.findOne(id);
    if (!review) throw new NotFoundException(`Unknown review ${id}`);
    return review;
  }

  @Delete()
  @HttpCode(204)
  removeAll() {
    return this.reviewsService.removeAll();
  }

  /**
   * 202: the review is created and running; its progress comes through the events stream.
   * 402 when the workspace has no reviews left this month, 409 when one is already running.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  start(@Body() body: CreateReviewDto) {
    if (!body?.documentId || !body?.lawyerId) {
      throw new BadRequestException('documentId and lawyerId are required');
    }
    return this.reviewsService.start(body);
  }
}
