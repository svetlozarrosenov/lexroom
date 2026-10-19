import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Finding } from '../../findings/entities/finding.entity.js';
import { Review } from '../../reviews/entities/review.entity.js';
import { ReviewStatus } from '../../reviews/review-status.enum.js';
import { Plan } from '../entities/plan.entity.js';
import { PlanService, startOfMonth } from './plan.service.js';

const DOC = '639fb780-cfdf-4393-bf6e-6a330940b21e';
const LAWYER = '7c1f3d2a-9b64-4e0f-8a21-5d3e6f7a8b90';

describe('PlanService', () => {
  let service: PlanService;
  let plans: Repository<Plan>;
  let reviews: Repository<Review>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Plan, Review, Finding],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Plan, Review]),
      ],
      providers: [PlanService],
    }).compile();

    service = moduleRef.get(PlanService);
    plans = moduleRef.get(getRepositoryToken(Plan));
    reviews = moduleRef.get(getRepositoryToken(Review));
  });

  /** Inserts a review created `daysAgo` days ago with the given status. */
  async function review(status: ReviewStatus, daysAgo = 0) {
    const { identifiers } = await reviews.insert({ documentId: DOC, lawyerId: LAWYER, status });
    await reviews.update(identifiers[0].id, { createdAt: new Date(Date.now() - daysAgo * 86_400_000) });
  }

  it('starts with 10 reviews, none used', async () => {
    expect(await service.current()).toEqual({ max: 10, used: 0, remaining: 10 });
  });

  it('keeps a single plan row', async () => {
    await service.current();
    await service.current();

    expect(await plans.count()).toBe(1);
  });

  it('counts completed reviews of this month as used', async () => {
    await review(ReviewStatus.Completed);
    await review(ReviewStatus.Completed);

    expect(await service.current()).toEqual({ max: 10, used: 2, remaining: 8 });
  });

  it('does not count failed or running reviews', async () => {
    await review(ReviewStatus.Failed);
    await review(ReviewStatus.Running);
    await review(ReviewStatus.Completed);

    expect((await service.current()).used).toBe(1);
  });

  it('does not count reviews of previous months, so the allowance renews on the 1st', async () => {
    const daysIntoMonth = (Date.now() - startOfMonth().getTime()) / 86_400_000;
    await review(ReviewStatus.Completed, daysIntoMonth + 1);
    await review(ReviewStatus.Completed, daysIntoMonth + 40);
    await review(ReviewStatus.Completed);

    expect((await service.current()).used).toBe(1);
  });

  it('hasAllowance is false exactly when the month is used up', async () => {
    await plans.save(plans.create({ max: 2 }));
    await review(ReviewStatus.Completed);
    expect(await service.hasAllowance()).toBe(true);

    await review(ReviewStatus.Completed);
    expect(await service.hasAllowance()).toBe(false);
    expect((await service.current()).remaining).toBe(0);
  });

  it('completeWithinPlan completes a running review while the month has room, and refuses once it has none', async () => {
    await plans.save(plans.create({ max: 2 }));
    await review(ReviewStatus.Completed);
    const { identifiers: [a] } = await reviews.insert({ documentId: DOC, lawyerId: LAWYER, status: ReviewStatus.Running });
    const { identifiers: [b] } = await reviews.insert({ documentId: 'other', lawyerId: LAWYER, status: ReviewStatus.Running });

    expect(await service.completeWithinPlan(a.id)).toBe(true);
    expect(await service.completeWithinPlan(b.id)).toBe(false);

    expect((await reviews.findOneByOrFail({ id: a.id })).status).toBe(ReviewStatus.Completed);
    expect((await reviews.findOneByOrFail({ id: b.id })).status).toBe(ReviewStatus.Running);
    expect(await service.current()).toEqual({ max: 2, used: 2, remaining: 0 });
  });

  it('completeWithinPlan does nothing to a review that is no longer running', async () => {
    const { identifiers: [failed] } = await reviews.insert({ documentId: DOC, lawyerId: LAWYER, status: ReviewStatus.Failed });

    expect(await service.completeWithinPlan(failed.id)).toBe(false);
    expect((await reviews.findOneByOrFail({ id: failed.id })).status).toBe(ReviewStatus.Failed);
  });

  it('removeAll deletes the plan row so the next use starts from the default allowance', async () => {
    await plans.save(plans.create({ max: 3 }));

    await service.removeAll();

    expect(await plans.count()).toBe(0);
    expect((await service.current()).max).toBe(10);
  });

  it('startOfMonth is the first instant of the month in UTC', () => {
    expect(startOfMonth(new Date('2026-10-19T23:30:00Z')).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(startOfMonth(new Date('2026-01-01T00:00:00Z')).toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});
