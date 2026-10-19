import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewStatus } from '../../reviews/review-status.enum.js';
import { ReviewsService } from '../../reviews/services/reviews.service.js';
import { Document } from '../entities/document.entity.js';
import { DOCUMENTS_SOURCE_FILE, DocumentsService } from './documents.service.js';

const NDA = '639fb780-cfdf-4393-bf6e-6a330940b21e';
const LEASE_V2 = 'a8d4c1e0-5f3b-4b7a-9e2d-6c1f0b3a7d58';
const LEASE_V1 = '125c8706-e702-4d6f-b2c5-80aeb110cd5c';

type StubReview = {
  id: string;
  documentId: string;
  lawyerId: string;
  status: ReviewStatus;
  createdAt: Date;
  findings: unknown[];
};

/** Mimics ReviewsService.findLatestPerDocument over reviews given newest first. */
function latestPerDocument(reviews: StubReview[], documentId?: string) {
  const seen = new Set<string>();
  return reviews
    .filter((r) => !documentId || r.documentId === documentId)
    .filter((r) => !seen.has(r.documentId) && seen.add(r.documentId))
    .map(({ findings, ...r }) => ({ ...r, findingsCount: findings.length }));
}

async function setup(reviews: StubReview[] = []) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({ type: 'better-sqlite3', database: ':memory:', entities: [Document], synchronize: true }),
      TypeOrmModule.forFeature([Document]),
    ],
    providers: [
      DocumentsService,
      { provide: DOCUMENTS_SOURCE_FILE, useValue: '../samples/documents.json' },
      {
        provide: ReviewsService,
        useValue: { findLatestPerDocument: async (documentId?: string) => latestPerDocument(reviews, documentId) },
      },
    ],
  }).compile();
  return {
    service: moduleRef.get(DocumentsService),
    repo: moduleRef.get<Repository<Document>>(getRepositoryToken(Document)),
  };
}

describe('DocumentsService', () => {
  it('seeds the 13 documents from samples/documents.json without their findings', async () => {
    const { service, repo } = await setup();

    expect(await service.seed()).toBe(13);

    const nda = await repo.findOneByOrFail({ id: NDA });
    expect(nda).toMatchObject({ title: 'Non-disclosure agreement — Alfa Robotics S.r.l.', type: 'nda', pages: 4 });
    expect(nda).not.toHaveProperty('findings');
    expect((await repo.findOneByOrFail({ id: LEASE_V2 })).supersedes).toBe(LEASE_V1);
  });

  it('seeds only the documents that are missing', async () => {
    const { service, repo } = await setup();
    await service.seed();
    await repo.delete({ id: NDA });

    expect(await service.seed()).toBe(1);
    expect(await repo.count()).toBe(13);
    expect(await service.seed()).toBe(0);
  });

  it('lists documents with the state of their latest review, or null', async () => {
    const older = new Date('2026-10-18T10:00:00Z');
    const newer = new Date('2026-10-18T11:00:00Z');
    const { service } = await setup([
      // newest first, as ReviewsService.findAll returns them
      { id: 'r2', documentId: NDA, lawyerId: 'l', status: ReviewStatus.Running, createdAt: newer, findings: [{}] },
      { id: 'r1', documentId: NDA, lawyerId: 'l', status: ReviewStatus.Completed, createdAt: older, findings: [{}, {}, {}] },
    ]);
    await service.seed();

    const documents = await service.findAll();

    expect(documents).toHaveLength(13);
    expect(documents.find((d) => d.id === NDA)?.latestReview).toEqual({
      id: 'r2',
      status: ReviewStatus.Running,
      lawyerId: 'l',
      createdAt: newer,
      findingsCount: 1,
    });
    expect(documents.find((d) => d.id === LEASE_V1)?.latestReview).toBeNull();
  });

  it('returns one document with its latest review, or null for an unknown id', async () => {
    const { service } = await setup([
      { id: 'r1', documentId: NDA, lawyerId: 'l', status: ReviewStatus.Failed, createdAt: new Date(), findings: [] },
    ]);
    await service.seed();

    expect((await service.findOne(NDA))?.latestReview).toMatchObject({ id: 'r1', status: 'failed', findingsCount: 0 });
    expect((await service.findOne(LEASE_V1))?.latestReview).toBeNull();
    expect(await service.findOne('nope')).toBeNull();
  });
});
