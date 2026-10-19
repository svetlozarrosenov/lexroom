import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { readFile } from 'node:fs/promises';
import { Repository } from 'typeorm';
import type { ReviewStatus } from '../../reviews/review-status.enum.js';
import { ReviewsService } from '../../reviews/services/reviews.service.js';
import type { ReviewWithFindingsCount } from '../../reviews/services/reviews.service.js';
import { Document } from '../entities/document.entity.js';

/** Injection token for the path to samples/documents.json. */
export const DOCUMENTS_SOURCE_FILE = Symbol('DOCUMENTS_SOURCE_FILE');

export type LatestReview = {
  id: string;
  status: ReviewStatus;
  lawyerId: string;
  createdAt: Date;
  findingsCount: number;
};

export type DocumentWithLatestReview = Document & { latestReview: LatestReview | null };

function summary({ id, status, lawyerId, createdAt, findingsCount }: ReviewWithFindingsCount): LatestReview {
  return { id, status, lawyerId, createdAt, findingsCount };
}

@Injectable()
export class DocumentsService implements OnModuleInit {
  constructor(
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,
    private readonly reviews: ReviewsService,
    @Inject(DOCUMENTS_SOURCE_FILE) private readonly sourceFile: string,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seed();
  }

  /** Inserts the documents from the samples file that are not in the database yet. */
  async seed(): Promise<number> {
    const raw = JSON.parse(await readFile(this.sourceFile, 'utf8')) as (Document & { findings: unknown })[];
    // The findings in the file are the fake AI's answers, not part of the document.
    const samples = raw.map(({ findings: _findings, ...document }) => document);

    const existing = new Set((await this.documents.find({ select: { id: true } })).map((d) => d.id));
    const missing = samples.filter((d) => !existing.has(d.id));
    if (missing.length > 0) {
      await this.documents.insert(missing);
    }
    return missing.length;
  }

  /** All documents, oldest upload first, each with the state of its latest review. */
  async findAll(): Promise<DocumentWithLatestReview[]> {
    const [documents, latest] = await Promise.all([
      this.documents.find({ order: { uploadedAt: 'ASC' } }),
      this.reviews.findLatestPerDocument(),
    ]);
    const latestByDocument = new Map(latest.map((review) => [review.documentId, summary(review)]));
    return documents.map((document) => ({
      ...document,
      latestReview: latestByDocument.get(document.id) ?? null,
    }));
  }

  /** One document with the state of its latest review, or null if unknown. */
  async findOne(id: string): Promise<DocumentWithLatestReview | null> {
    const document = await this.documents.findOneBy({ id });
    if (!document) return null;
    const [latest] = await this.reviews.findLatestPerDocument(id);
    return { ...document, latestReview: latest ? summary(latest) : null };
  }
}
