import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ReviewsService } from '../services/reviews.service.js';
import type { CreateReviewDto } from '../dto/create-review.dto.js';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  findAll(@Query('documentId') documentId?: string) {
    return this.reviewsService.findAll(documentId);
  }

  @Delete()
  @HttpCode(204)
  removeAll() {
    return this.reviewsService.removeAll();
  }

  @Post()
  start(@Body() body: CreateReviewDto) {
    if (!body?.documentId || !body?.lawyerId) {
      throw new BadRequestException('documentId and lawyerId are required');
    }
    return this.reviewsService.start(body);
  }
}
