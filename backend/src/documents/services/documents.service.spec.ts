import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Finding } from '../../findings/entities/finding.entity.js';
import { Review } from '../../reviews/entities/review.entity.js';
import { ReviewStatus } from '../../reviews/review-status.enum.js';
import { Document } from '../entities/document.entity.js';
import {
  DOCUMENTS_SOURCE_FILE,
  DocumentsService,
} from './documents.service.js';

const NDA = '639fb780-cfdf-4393-bf6e-6a330940b21e';
const LEASE_V2 = 'a8d4c1e0-5f3b-4b7a-9e2d-6c1f0b3a7d58';
const LEASE_V1 = '125c8706-e702-4d6f-b2c5-80aeb110cd5c';
const LAWYER = '7c1f3d2a-9b64-4e0f-8a21-5d3e6f7a8b90';

const FINDING = {
  clause: null,
  title: 't',
  severity: 'low',
  excerpt: null,
  explanation: 'e',
} as const;

async function setup() {
  const moduleRef = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'better-sqlite3',
        database: ':memory:',
        entities: [Document, Review, Finding],
        synchronize: true,
      }),
      TypeOrmModule.forFeature([Document, Review, Finding]),
    ],
    providers: [
      DocumentsService,
      { provide: DOCUMENTS_SOURCE_FILE, useValue: '../samples/documents.json' },
    ],
  }).compile();

  const reviews = moduleRef.get<Repository<Review>>(getRepositoryToken(Review));
  const findings = moduleRef.get<Repository<Finding>>(
    getRepositoryToken(Finding),
  );

  return {
    service: moduleRef.get(DocumentsService),
    repo: moduleRef.get<Repository<Document>>(getRepositoryToken(Document)),
    /** Inserts a review with `findingsCount` findings, created at `createdAt`. */
    async review(
      documentId: string,
      status: ReviewStatus,
      findingsCount = 0,
      createdAt = new Date(),
    ) {
      const { identifiers } = await reviews.insert({
        documentId,
        lawyerId: LAWYER,
        status,
      });
      const id: string = identifiers[0].id;
      await reviews.update(id, { createdAt });
      if (findingsCount > 0) {
        await findings.insert(
          Array.from({ length: findingsCount }, () => ({
            reviewId: id,
            content: FINDING,
          })),
        );
      }
      return id;
    },
  };
}

describe('DocumentsService', () => {
  it('seeds the 13 documents from samples/documents.json without their findings', async () => {
    const { service, repo } = await setup();

    expect(await service.seed()).toBe(13);

    const nda = await repo.findOneByOrFail({ id: NDA });
    expect(nda).toMatchObject({
      title: 'Non-disclosure agreement — Alfa Robotics S.r.l.',
      type: 'nda',
      pages: 4,
    });
    expect(nda).not.toHaveProperty('findings');
    expect((await repo.findOneByOrFail({ id: LEASE_V2 })).supersedes).toBe(
      LEASE_V1,
    );
  });

  it('seeds only the documents that are missing', async () => {
    const { service, repo } = await setup();
    await service.seed();
    await repo.delete({ id: NDA });

    expect(await service.seed()).toBe(1);
    expect(await repo.count()).toBe(13);
    expect(await service.seed()).toBe(0);
  });

  it('lists documents with their latest review and its findings count, or null, in one query', async () => {
    const { service, review } = await setup();
    await service.seed();
    const older = new Date('2026-10-18T10:00:00Z');
    const newer = new Date('2026-10-18T11:00:00Z');
    await review(NDA, ReviewStatus.Completed, 3, older);
    const r2 = await review(NDA, ReviewStatus.Running, 1, newer);

    const documents = await service.findAll();

    expect(documents).toHaveLength(13);
    expect(documents.map((d) => d.id)).toEqual(
      [...documents]
        .sort((a, b) => (a.uploadedAt < b.uploadedAt ? -1 : 1))
        .map((d) => d.id),
    );
    expect(documents.find((d) => d.id === NDA)?.latestReview).toMatchObject({
      id: r2,
      status: ReviewStatus.Running,
      lawyerId: LAWYER,
      createdAt: newer,
      findingsCount: 1,
    });
    // The findings themselves are not loaded.
    expect(
      documents.find((d) => d.id === NDA)?.latestReview?.findings,
    ).toBeUndefined();
    expect(documents.find((d) => d.id === LEASE_V1)?.latestReview).toBeNull();
  });

  it('breaks a same-second tie in favour of the review created last', async () => {
    const { service, review } = await setup();
    await service.seed();
    const at = new Date('2026-10-18T10:00:00Z');
    await review(NDA, ReviewStatus.Failed, 0, at);
    const last = await review(NDA, ReviewStatus.Completed, 0, at);

    expect((await service.findOne(NDA))?.latestReview?.id).toBe(last);
  });

  it('returns one document with its latest review, or null for an unknown id', async () => {
    const { service, review } = await setup();
    await service.seed();
    await review(NDA, ReviewStatus.Failed);

    expect((await service.findOne(NDA))?.latestReview).toMatchObject({
      status: 'failed',
      findingsCount: 0,
    });
    expect((await service.findOne(LEASE_V1))?.latestReview).toBeNull();
    expect(await service.findOne('nope')).toBeNull();
  });
});
