import { Column, Entity, PrimaryColumn } from 'typeorm';

/** A document of the workspace, seeded from samples/documents.json. */
@Entity('documents')
export class Document {
  /** Id from samples/documents.json, kept as is so the samples stay the source of truth. */
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  type: string;

  @Column({ type: 'integer' })
  pages: number;

  @Column({ type: 'text' })
  uploadedAt: string;

  /** Lawyer from samples/lawyers.json */
  @Column({ type: 'text' })
  uploadedBy: string;

  /** Id of the document this one replaces, if any (a newer version of the same contract). */
  @Column({ type: 'text', nullable: true })
  supersedes: string | null;
}
