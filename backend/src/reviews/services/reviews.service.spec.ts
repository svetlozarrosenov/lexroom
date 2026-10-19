import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AI_PROVIDER } from '../../ai/interfaces/ai-provider.interface.js';
import type { AiFinding, AiProvider } from '../../ai/interfaces/ai-provider.interface.js';
import { sleep } from '../../ai/providers/fake-ai.provider.js';
import { Plan } from '../../plan/entities/plan.entity.js';
import { PlanService } from '../../plan/services/plan.service.js';
import { Document } from '../../documents/entities/document.entity.js';
import { Finding } from '../../findings/entities/finding.entity.js';
import { Review } from '../entities/review.entity.js';
import { ReviewStatus } from '../review-status.enum.js';
import type { ReviewEvent } from '../review-event.js';
import { ReviewEventsService } from './review-events.service.js';
import { REVIEW_TIMEOUT_MS, ReviewsService } from './reviews.service.js';

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

/** AI stub whose reviews all wait for `release()` before returning the same findings. */
function gatedAi(findings: AiFinding[]): { ai: AiProvider; release: () => void } {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  return {
    release,
    ai: {
      async *review() {
        await gate;
        yield* findings;
      },
    },
  };
}

async function setup(ai: AiProvider) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'better-sqlite3',
        database: ':memory:',
        entities: [Review, Finding, Plan, Document],
        synchronize: true,
      }),
      TypeOrmModule.forFeature([Review, Finding, Plan, Document]),
    ],
    providers: [ReviewsService, PlanService, ReviewEventsService, { provide: AI_PROVIDER, useValue: ai }],
  }).compile();

  const service = moduleRef.get(ReviewsService);
  const events = moduleRef.get(ReviewEventsService);

  return {
    service,
    events,
    plan: moduleRef.get(PlanService),
    reviews: moduleRef.get<Repository<Review>>(getRepositoryToken(Review)),
    findings: moduleRef.get<Repository<Finding>>(getRepositoryToken(Finding)),
    plans: moduleRef.get<Repository<Plan>>(getRepositoryToken(Plan)),
    documents: moduleRef.get<Repository<Document>>(getRepositoryToken(Document)),
    /** Starts a review and waits until it is completed or failed, as a client would. */
    async finish(documentId: string, lawyerId: string): Promise<Review> {
      const review = await service.start({ documentId, lawyerId });
      await ended(events, review.id);
      return service.findOne(review.id) as Promise<Review>;
    },
  };
}

/** Resolves with the first status other than "running" the bus reports for a review. */
function ended(events: ReviewEventsService, reviewId: string): Promise<ReviewStatus> {
  return new Promise((resolve) => {
    const subscription = events.all().subscribe((event) => {
      if (event.reviewId === reviewId && event.type === 'status' && event.status !== ReviewStatus.Running) {
        subscription.unsubscribe();
        resolve(event.status);
      }
    });
  });
}

function kinds(received: ReviewEvent[]): string[] {
  return received.map((e) => (e.type === 'status' ? e.status : 'finding'));
}

describe('ReviewsService', () => {
  it('returns the review as running at once; completion is reported through events', async () => {
    const { service, events } = await setup(aiStub({ [DOC_A]: FINDINGS }));

    const review = await service.start({ documentId: DOC_A, lawyerId: CHIARA });
    expect(review.status).toBe(ReviewStatus.Running);

    expect(await ended(events, review.id)).toBe(ReviewStatus.Completed);
  });

  it('completes the review and stores the findings the AI returns for the document', async () => {
    const { finish, findings } = await setup(aiStub({ [DOC_A]: FINDINGS }));

    const review = await finish(DOC_A, CHIARA);

    expect(review.status).toBe(ReviewStatus.Completed);
    expect(review.findings.map((f) => f.content)).toEqual(FINDINGS);
    expect(await findings.countBy({ reviewId: review.id })).toBe(FINDINGS.length);
  });

  it('stores no findings for a document the AI has nothing to say about', async () => {
    const { finish, findings } = await setup(aiStub({}));

    const review = await finish(DOC_A, CHIARA);

    expect(review.status).toBe(ReviewStatus.Completed);
    expect(review.findings).toEqual([]);
    expect(await findings.countBy({ reviewId: review.id })).toBe(0);
  });

  it('each completed review uses one of the plan', async () => {
    const { finish, plan } = await setup(aiStub({ [DOC_A]: FINDINGS }));

    await finish(DOC_A, CHIARA);
    await finish(DOC_B, CHIARA);

    expect(await plan.current()).toEqual({ max: 10, used: 2, remaining: 8 });
  });

  it('with one review left and two running, completes one and fails the other, keeping its findings', async () => {
    // The request-time check lets both through: the plan has one review left when each is
    // requested. The binding check is the one at completion.
    const { ai, release } = gatedAi(FINDINGS);
    const { service, events, findings, plan, plans } = await setup(ai);
    await plans.save(plans.create({ max: 1 }));
    const first = await service.start({ documentId: DOC_A, lawyerId: CHIARA });
    const second = await service.start({ documentId: DOC_B, lawyerId: RICCARDO });
    const endings = Promise.all([ended(events, first.id), ended(events, second.id)]);

    release();
    const statuses = await endings;

    expect([...statuses].sort()).toEqual([ReviewStatus.Completed, ReviewStatus.Failed]);
    const failed = statuses[0] === ReviewStatus.Failed ? first : second;
    expect(await findings.countBy({ reviewId: failed.id })).toBe(FINDINGS.length);
    expect(await plan.current()).toEqual({ max: 1, used: 1, remaining: 0 });
  });

  it('refuses a request up front with 402 once the plan is used up, creating nothing and leaving a reminder', async () => {
    const { service, reviews, documents, plans } = await setup(aiStub({}));
    await plans.save(plans.create({ max: 0 }));
    const doc = { id: DOC_A, title: 't', type: 'nda', pages: 1, uploadedAt: 'x', uploadedBy: 'l', supersedes: null };
    await documents.insert({ ...doc, reviewRequestedAt: null });

    await expect(service.start({ documentId: DOC_A, lawyerId: CHIARA })).rejects.toMatchObject({ status: 402 });

    expect(await reviews.count()).toBe(0);
    expect((await documents.findOneByOrFail({ id: DOC_A })).reviewRequestedAt).toBeInstanceOf(Date);
  });

  it('on boot, marks reviews left running by a previous process as failed, freeing their documents', async () => {
    const { service, reviews } = await setup(aiStub({}));
    await reviews.insert({ documentId: DOC_A, lawyerId: CHIARA, status: ReviewStatus.Running });
    await reviews.insert({ documentId: DOC_B, lawyerId: CHIARA, status: ReviewStatus.Completed });

    await service.onModuleInit();

    expect((await reviews.findOneByOrFail({ documentId: DOC_A })).status).toBe(ReviewStatus.Failed);
    expect((await reviews.findOneByOrFail({ documentId: DOC_B })).status).toBe(ReviewStatus.Completed);
    // The document is free again: a new review of it can be created.
    expect((await service.start({ documentId: DOC_A, lawyerId: RICCARDO })).status).toBe(ReviewStatus.Running);
  });

  it('clears the "requested while the plan was used up" reminder when a review completes', async () => {
    // DOC_A fails after its first finding; DOC_B has none to fail on and completes.
    const { finish, documents } = await setup(aiStub({ [DOC_A]: FINDINGS }, 1));
    const requestedAt = new Date('2026-10-05T10:00:00Z');
    const doc = { id: DOC_A, title: 't', type: 'nda', pages: 1, uploadedAt: 'x', uploadedBy: 'l', supersedes: null };
    await documents.insert({ ...doc, reviewRequestedAt: requestedAt });
    await documents.insert({ ...doc, id: DOC_B, reviewRequestedAt: requestedAt });

    expect((await finish(DOC_A, CHIARA)).status).toBe(ReviewStatus.Failed);
    expect((await documents.findOneByOrFail({ id: DOC_A })).reviewRequestedAt).toEqual(requestedAt);

    expect((await finish(DOC_B, CHIARA)).status).toBe(ReviewStatus.Completed);
    expect((await documents.findOneByOrFail({ id: DOC_B })).reviewRequestedAt).toBeNull();
  });

  it('marks the review failed when the AI fails midway, keeping the findings it had returned', async () => {
    const { finish, findings, plan } = await setup(aiStub({ [DOC_A]: FINDINGS }, 1));

    const review = await finish(DOC_A, CHIARA);

    expect(review.status).toBe(ReviewStatus.Failed);
    expect(review.findings.map((f) => f.content)).toEqual([FINDINGS[0]]);
    expect(await findings.count()).toBe(1);
    expect((await plan.current()).used).toBe(0);
  });

  it('frees the document for a retry after a failed review', async () => {
    const { finish, reviews } = await setup(aiStub({ [DOC_A]: FINDINGS }, 0));
    expect((await finish(DOC_A, CHIARA)).status).toBe(ReviewStatus.Failed);

    // Retry succeeds only because the failed review no longer holds the "running" slot.
    expect((await finish(DOC_A, RICCARDO)).status).toBe(ReviewStatus.Failed);

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
    const { finish, reviews } = await setup(aiStub({}));
    const first = await finish(DOC_A, CHIARA);
    const second = await finish(DOC_A, RICCARDO);

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
    const { service, finish, reviews } = await setup(aiStub({ [DOC_A]: FINDINGS, [DOC_B]: [FINDINGS[0]] }));
    const older = await finish(DOC_A, CHIARA);
    await finish(DOC_B, CHIARA);
    const newer = await finish(DOC_A, RICCARDO);
    // createdAt has second precision in SQLite; push the first review clearly into the past.
    await reviews.update(older.id, { createdAt: new Date(Date.now() - 60_000) });

    const listed = await service.findAll(DOC_A);

    expect(listed.map((r) => r.id)).toEqual([newer.id, older.id]);
    expect(listed.every((r) => r.findings.length === FINDINGS.length)).toBe(true);
    expect(await service.findAll()).toHaveLength(3);
  });

  it('finds the latest review of every document with its findings count, without the findings', async () => {
    const { service, finish, reviews } = await setup(aiStub({ [DOC_A]: FINDINGS, [DOC_B]: [FINDINGS[0]] }));
    const older = await finish(DOC_A, CHIARA);
    const b = await finish(DOC_B, CHIARA);
    const newer = await finish(DOC_A, RICCARDO);
    await reviews.update(older.id, { createdAt: new Date(Date.now() - 60_000) });

    const latest = await service.findLatestPerDocument();

    expect(latest.map((r) => [r.documentId, r.id, r.findingsCount]).sort()).toEqual(
      [
        [DOC_A, newer.id, 2],
        [DOC_B, b.id, 1],
      ].sort(),
    );
    // Class fields exist as own properties (set to undefined); the findings are not loaded.
    expect(latest[0].findings).toBeUndefined();
    expect(latest[0].createdAt).toBeInstanceOf(Date);
    expect((await service.findLatestPerDocument(DOC_A)).map((r) => r.id)).toEqual([newer.id]);
    expect(await service.findLatestPerDocument('nope')).toEqual([]);
  });

  it('breaks a same-second tie in favour of the review created last', async () => {
    const { service, finish } = await setup(aiStub({}));
    await finish(DOC_A, CHIARA);
    const last = await finish(DOC_A, RICCARDO);

    expect((await service.findLatestPerDocument(DOC_A)).map((r) => r.id)).toEqual([last.id]);
  });

  it('emits running, one event per finding, then completed', async () => {
    const { finish, events } = await setup(aiStub({ [DOC_A]: FINDINGS }));
    const received: ReviewEvent[] = [];
    events.forDocument(DOC_A).subscribe((e) => received.push(e));

    const review = await finish(DOC_A, CHIARA);

    expect(kinds(received)).toEqual(['running', 'finding', 'finding', 'completed']);
    expect(received.every((e) => e.reviewId === review.id)).toBe(true);
  });

  it('emits failed when the AI fails midway', async () => {
    const { finish, events } = await setup(aiStub({ [DOC_A]: FINDINGS }, 1));
    const received: ReviewEvent[] = [];
    events.forDocument(DOC_A).subscribe((e) => received.push(e));

    await finish(DOC_A, CHIARA);

    expect(kinds(received)).toEqual(['running', 'finding', 'failed']);
  });

  it('findOne returns a review with its findings, or null', async () => {
    const { service, finish } = await setup(aiStub({ [DOC_A]: FINDINGS }));
    const started = await finish(DOC_A, CHIARA);

    const found = await service.findOne(started.id);

    expect(found?.status).toBe(ReviewStatus.Completed);
    expect(found?.findings.map((f) => f.content)).toEqual(FINDINGS);
    expect(await service.findOne('nope')).toBeNull();
  });

  it('removeAll deletes every review and its findings', async () => {
    const { service, finish, reviews, findings } = await setup(aiStub({ [DOC_A]: FINDINGS }));
    await finish(DOC_A, CHIARA);
    await finish(DOC_B, CHIARA);

    await service.removeAll();

    expect(await reviews.count()).toBe(0);
    expect(await findings.count()).toBe(0);
  });

  it('deletes the findings together with their review', async () => {
    const { finish, reviews, findings } = await setup(aiStub({ [DOC_A]: FINDINGS }));
    const review = await finish(DOC_A, CHIARA);

    await reviews.delete(review.id);

    expect(await findings.count()).toBe(0);
  });

  describe('60 second timeout', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    /** AI that returns one finding, then is slow; honours the abort signal like the fake does. */
    function slowAi(slowMs: number, { honoursAbort = true } = {}): AiProvider & { aborted: boolean } {
      const ai = {
        aborted: false,
        async *review(_documentId: string, signal?: AbortSignal) {
          yield FINDINGS[0];
          await sleep(slowMs, honoursAbort ? signal : undefined);
          ai.aborted = signal?.aborted ?? false;
          if (honoursAbort && signal?.aborted) return;
          yield FINDINGS[1];
        },
      };
      return ai;
    }

    it('fails a review still running after 60 s, cuts the AI off and leaves the plan untouched', async () => {
      const ai = slowAi(100_000);
      const { service, events, findings, plan } = await setup(ai);
      const received: ReviewEvent[] = [];
      events.forDocument(DOC_A).subscribe((e) => received.push(e));

      const review = await service.start({ documentId: DOC_A, lawyerId: CHIARA });
      const done = ended(events, review.id);
      await vi.advanceTimersByTimeAsync(REVIEW_TIMEOUT_MS);

      expect(await done).toBe(ReviewStatus.Failed);
      expect(ai.aborted).toBe(true);
      expect(kinds(received)).toEqual(['running', 'finding', 'failed']);
      expect(await findings.countBy({ reviewId: review.id })).toBe(1);
      expect((await plan.current()).used).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('ignores a finding the AI returns after the timeout', async () => {
      const ai = slowAi(100_000, { honoursAbort: false });
      const { service, events, findings } = await setup(ai);

      const review = await service.start({ documentId: DOC_A, lawyerId: CHIARA });
      const done = ended(events, review.id);
      await vi.advanceTimersByTimeAsync(100_000);

      expect(await done).toBe(ReviewStatus.Failed);
      expect(await findings.countBy({ reviewId: review.id })).toBe(1);
    });

    it('does not complete or charge the plan when the AI finishes after the timeout', async () => {
      const ai: AiProvider = {
        async *review() {
          await sleep(70_000);
          yield* [];
        },
      };
      const { service, events, reviews, plan } = await setup(ai);

      const review = await service.start({ documentId: DOC_A, lawyerId: CHIARA });
      const done = ended(events, review.id);
      await vi.advanceTimersByTimeAsync(70_000);

      expect(await done).toBe(ReviewStatus.Failed);
      expect((await reviews.findOneByOrFail({ id: review.id })).status).toBe(ReviewStatus.Failed);
      expect((await plan.current()).used).toBe(0);
    });

    it('completes a review that finishes in time and clears its timer', async () => {
      const ai = slowAi(20_000);
      const { service, events, plan } = await setup(ai);

      const review = await service.start({ documentId: DOC_A, lawyerId: CHIARA });
      const done = ended(events, review.id);
      await vi.advanceTimersByTimeAsync(20_000);

      expect(await done).toBe(ReviewStatus.Completed);
      expect(ai.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      expect((await plan.current()).remaining).toBe(9);
    });
  });
});
