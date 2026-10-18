export type AiSeverity = 'high' | 'medium' | 'low';

export type AiFinding = {
  clause: string | null;
  title: string;
  severity: AiSeverity;
  excerpt: string | null;
  explanation: string;
};

/**
 * Strategy for the AI that reviews contracts. ReviewsService depends on this token,
 * never on a concrete class, so swapping the fake for a real model is a one-line
 * change in AiModule.
 */
export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AiProvider {
  /**
   * Reviews a document and yields its findings one at a time, as the AI produces them.
   * Iteration ends when the review is complete. A failed review throws from the
   * iterator, possibly after some findings were already yielded.
   * Aborting the signal stops the review as soon as possible.
   */
  review(documentId: string, signal?: AbortSignal): AsyncIterable<AiFinding>;
}
