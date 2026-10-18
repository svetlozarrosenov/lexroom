import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AI_PROVIDER } from '../../ai/interfaces/ai-provider.interface.js';
import type { AiFinding, AiProvider } from '../../ai/interfaces/ai-provider.interface.js';
import { Plan } from '../../plan/entities/plan.entity.js';
import { PlanService } from '../../plan/services/plan.service.js';
import { Finding } from '../../findings/entities/finding.entity.js';
import { Review } from '../entities/review.entity.js';
import { ReviewStatus } from '../review-status.enum.js';
import { ReviewsService } from './reviews.service.js';

const DOC_A = '639fb780-cfdf-4393-bf6e-6a330940b21e';
const DOC_B = '125c8706-e702-4d6f-b2c5-80aeb110cd5c';
const CHIARA = '7c1f3d2a-9b64-4e0f-8a21-5d3e6f7a8b90';
const RICCARDO = 'e4a8b6c2-1d3f-4a5b-9c7e-2f8a9b0c1d2e';

const FINDINGS: AiFinding[] = [
  { clause: '5.1', title: 'Liability is not capped', severity: 'high', excerpt: 'x', explanation: 'a' },
  { clause: null, title: 'No governing law', severity: 'low', excerpt: null, explanation: 'b' },
];

/** AI stub: fixed findings per document, or a failure after some of them. */
function aiStub(findingsByDoc: Record<string, AiFinding[]>, failAfter = Infinity): AiProvider {
  return {
    async *review(documentId) {
      const findings = findingsByDoc[documentId] ?? [];
      for (let i = 0; i < findings.length; i++) {
        if (i === failAfter) throw new Error('AI failed');
        yield findings[i];
      }
      if (failAfter === findings.length) throw new Error('AI failed');
    },
  };
}

async function setup(ai: AiProvider) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'better-sqlite3',
        database: ':memory:',
        entities: [Review, Finding, Plan],
        synchronize: true,
      }),
      TypeOrmModule.forFeature([Review, Finding, Plan]),
    ],
    providers: [ReviewsService, PlanService, { provide: AI_PROVIDER, useValue: ai }],
  }).compile();

  return {
    service: moduleRef.get(ReviewsService),
    reviews: moduleRef.get<Repository<Review>>(getRepositoryToken(Review)),
    findings: moduleRef.get<Repository<Finding>>(getRepositoryToken(Finding)),
    plans: moduleRef.get<Repository<Plan>>(getRepositoryToken(Plan)),
  };
}

describe('ReviewsService', () => {
  it('completes the review and stores the findings the AI returns for the document', async () => {
    const { service, findings } = await setup(aiStub({ [DOC_A]: FINDINGS }));

    const review = await service.start({ documentId: DOC_A, lawyerId: CHIARA });

    expect(review.status).toBe(ReviewStatus.Completed);
    expect(review.findings.map((f) => f.content)).toEqual(FINDINGS);
    expect(await findings.countBy({ reviewId: review.id })).toBe(FINDINGS.length);
  });

  it('stores no findings for a document the AI has nothing to say about', async () => {
    const { service, findings } = await setup(aiStub({}));

    const review = await service.start({ documentId: DOC_A, lawyerId: CHIARA });

    expect(review.findings).toEqual([]);
    expect(await findings.countBy({ reviewId: review.id })).toBe(0);
  });

  it('takes one review from the plan', async () => {
    const { service, plans } = await setup(aiStub({ [DOC_A]: FINDINGS }));

    await service.start({ documentId: DOC_A, lawyerId: CHIARA });
    await service.start({ documentId: DOC_B, lawyerId: CHIARA });

    expect((await plans.findOneByOrFail({})).remaining).toBe(8);
  });

  it('marks the review failed when the plan is used up, keeping findings and plan untouched', async () => {
    const { service, reviews, findings, plans } = await setup(aiStub({ [DOC_A]: FINDINGS }));
    await plans.save(plans.create({ max: 10, remaining: 0 }));

    await expect(service.start({ documentId: DOC_A, lawyerId: CHIARA })).rejects.toMatchObject({ status: 402 });

    expect((await reviews.find()).map((r) => r.status)).toEqual([ReviewStatus.Failed]);
    expect(await findings.count()).toBe(0);
    expect((await plans.findOneByOrFail({})).remaining).toBe(0);
  });

  it('marks the review failed when the AI fails midway, rolling back findings and plan', async () => {
    const { service, reviews, findings, plans } = await setup(aiStub({ [DOC_A]: FINDINGS }, 1));
    await plans.save(plans.create({ max: 10, remaining: 10 }));

    await expect(service.start({ documentId: DOC_A, lawyerId: CHIARA })).rejects.toThrow('AI failed');

    expect((await reviews.find()).map((r) => r.status)).toEqual([ReviewStatus.Failed]);
    expect(await findings.count()).toBe(0);
    expect((await plans.findOneByOrFail({})).remaining).toBe(10);
  });

  it('frees the document for a retry after a failed review', async () => {
    const { service, reviews } = await setup(aiStub({ [DOC_A]: FINDINGS }, 0));
    await expect(service.start({ documentId: DOC_A, lawyerId: CHIARA })).rejects.toThrow('AI failed');

    // Retry succeeds only because the failed review no longer holds the "running" slot.
    const retry = service.start({ documentId: DOC_A, lawyerId: RICCARDO });
    await expect(retry).rejects.toThrow('AI failed');

    expect(await reviews.countBy({ status: ReviewStatus.Failed })).toBe(2);
  });

  it('rejects a second review while one is still running, even from another lawyer', async () => {
    const { service, reviews } = await setup(aiStub({ [DOC_A]: FINDINGS }));
    await reviews.insert({ documentId: DOC_A, lawyerId: CHIARA, status: ReviewStatus.Running });

    await expect(service.start({ documentId: DOC_A, lawyerId: RICCARDO })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(await reviews.count()).toBe(1);
  });

  it('allows a new review of the same document once the previous one completed', async () => {
    const { service, reviews } = await setup(aiStub({}));
    const first = await service.start({ documentId: DOC_A, lawyerId: CHIARA });
    const second = await service.start({ documentId: DOC_A, lawyerId: RICCARDO });

    expect(second.id).not.toBe(first.id);
    expect(await reviews.countBy({ status: ReviewStatus.Completed })).toBe(2);
  });

  it('enforces the one-running-review rule in the database itself', async () => {
    const { reviews } = await setup(aiStub({}));
    await reviews.insert({ documentId: DOC_A, lawyerId: CHIARA, status: ReviewStatus.Running });

    await expect(
      reviews.insert({ documentId: DOC_A, lawyerId: RICCARDO, status: ReviewStatus.Running }),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it('lists the reviews of one document with their findings, newest first', async () => {
    const { service, reviews } = await setup(aiStub({ [DOC_A]: FINDINGS, [DOC_B]: [FINDINGS[0]] }));
    const older = await service.start({ documentId: DOC_A, lawyerId: CHIARA });
    await service.start({ documentId: DOC_B, lawyerId: CHIARA });
    const newer = await service.start({ documentId: DOC_A, lawyerId: RICCARDO });
    // createdAt has second precision in SQLite; push the first review clearly into the past.
    await reviews.update(older.id, { createdAt: new Date(Date.now() - 60_000) });

    const listed = await service.findAll(DOC_A);

    expect(listed.map((r) => r.id)).toEqual([newer.id, older.id]);
    expect(listed.every((r) => r.findings.length === FINDINGS.length)).toBe(true);
    expect(await service.findAll()).toHaveLength(3);
  });

  it('removeAll deletes every review and its findings', async () => {
    const { service, reviews, findings } = await setup(aiStub({ [DOC_A]: FINDINGS }));
    await service.start({ documentId: DOC_A, lawyerId: CHIARA });
    await service.start({ documentId: DOC_B, lawyerId: CHIARA });

    await service.removeAll();

    expect(await reviews.count()).toBe(0);
    expect(await findings.count()).toBe(0);
  });

  it('deletes the findings together with their review', async () => {
    const { service, reviews, findings } = await setup(aiStub({ [DOC_A]: FINDINGS }));
    const review = await service.start({ documentId: DOC_A, lawyerId: CHIARA });

    await reviews.delete(review.id);

    expect(await findings.count()).toBe(0);
  });
});
