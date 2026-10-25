import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { readFile } from 'node:fs/promises';
import { Repository } from 'typeorm';
import { Review } from '../../reviews/entities/review.entity.js';
import { Document } from '../entities/document.entity.js';

/** Injection token for the path to samples/documents.json. */
export const DOCUMENTS_SOURCE_FILE = Symbol('DOCUMENTS_SOURCE_FILE');

@Injectable()
export class DocumentsService implements OnModuleInit {
  constructor(
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,
    @Inject(DOCUMENTS_SOURCE_FILE) private readonly sourceFile: string,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seed();
  }

  /** Inserts the documents from the samples file that are not in the database yet. */
  async seed(): Promise<number> {
    const raw = JSON.parse(
      await readFile(this.sourceFile, 'utf8'),
    ) as (Document & { findings: unknown })[];
    // The findings in the file are the fake AI's answers, not part of the document.
    const samples = raw.map(({ findings: _findings, ...document }) => document);

    const existing = new Set(
      (await this.documents.find({ select: { id: true } })).map((d) => d.id),
    );
    const missing = samples.filter((d) => !existing.has(d.id));
    if (missing.length > 0) {
      await this.documents.insert(missing);
    }
    return missing.length;
  }

  /**
   * All documents, oldest upload first, each with its latest review or null: one query, a
   * LEFT JOIN on the review whose id is the newest for the document (same-second ties go to
   * the later insert), with its findings count (a virtual column of Review) and without its
   * findings.
   */
  findAll(): Promise<Document[]> {
    return this.documents
      .createQueryBuilder('document')
      .leftJoinAndMapOne(
        'document.latestReview',
        Review,
        'review',
        'review.id = (SELECT id FROM reviews WHERE "documentId" = document.id ORDER BY "createdAt" DESC, rowid DESC LIMIT 1)',
      )
      .orderBy('document.uploadedAt', 'ASC')
      .getMany();
  }

  /** One document with its latest review or null, or null if unknown. Same join as `findAll`. */
  findOne(id: string): Promise<Document | null> {
    return this.documents
      .createQueryBuilder('document')
      .leftJoinAndMapOne(
        'document.latestReview',
        Review,
        'review',
        'review.id = (SELECT id FROM reviews WHERE "documentId" = document.id ORDER BY "createdAt" DESC, rowid DESC LIMIT 1)',
      )
      .where('document.id = :id', { id })
      .getOne();
  }
}
