import { Inject, Injectable, Optional } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import type { AiFinding, AiProvider } from '../interfaces/ai-provider.interface.js';

type SampleDocument = { id: string; findings: AiFinding[] };

/** Injection token for the path to samples/documents.json. */
export const DOCUMENTS_FILE = Symbol('DOCUMENTS_FILE');

/** Optional injection token to override randomness and timing (used by tests). */
export const FAKE_AI_OPTIONS = Symbol('FAKE_AI_OPTIONS');

export type FakeAiOptions = {
  /** Returns a number in [0, 1). */
  random: () => number;
  /** Waits `ms` milliseconds; resolves early, without throwing, if the signal aborts. */
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Share of reviews that fail with an error instead of finishing. */
  failureRate: number;
  /** Total duration of a review, min and max in milliseconds. */
  durationMs: [min: number, max: number];
};

export const DEFAULT_FAKE_AI_OPTIONS: FakeAiOptions = {
  random: Math.random,
  sleep,
  failureRate: 1 / 5,
  durationMs: [5_000, 30_000],
};

export class FakeAiFailedError extends Error {
  constructor() {
    super('The AI review failed');
    this.name = 'FakeAiFailedError';
  }
}

/**
 * The fake AI from the brief. Its "answers" are the findings listed for the document in
 * samples/documents.json, returned one at a time at random moments spread over 5 to 30
 * seconds. About 1 time in 5 it fails with an error instead of finishing, after having
 * returned some of the findings or none.
 *
 * Randomness is drawn in a fixed order so tests can script an outcome:
 * fails?, how many findings before failing, total duration, then one weight per step.
 */
@Injectable()
export class FakeAiProvider implements AiProvider {
  private readonly options: FakeAiOptions;
  private findingsById?: Promise<Map<string, AiFinding[]>>;

  constructor(
    @Inject(DOCUMENTS_FILE) private readonly documentsFile: string,
    @Optional() @Inject(FAKE_AI_OPTIONS) options?: Partial<FakeAiOptions>,
  ) {
    this.options = { ...DEFAULT_FAKE_AI_OPTIONS, ...options };
  }

  async *review(documentId: string, signal?: AbortSignal): AsyncIterable<AiFinding> {
    const findings = (await this.load()).get(documentId);
    if (!findings) {
      throw new Error(`Unknown document ${documentId}`);
    }

    const { random, sleep, failureRate, durationMs } = this.options;

    const fails = random() < failureRate;
    // On failure, stop after 0..n findings (n = all of them, failing right at the end).
    // The roll is always drawn so the order of random() calls is fixed.
    const failAfterRoll = random();
    const failAfter = fails ? Math.floor(failAfterRoll * (findings.length + 1)) : Infinity;
    const [min, max] = durationMs;
    const totalMs = min + random() * (max - min);

    // n findings + the completion = n + 1 steps, at random intervals that add up to totalMs.
    const steps = randomSplit(totalMs, findings.length + 1, random);

    for (let i = 0; i < findings.length; i++) {
      await sleep(steps[i], signal);
      if (signal?.aborted) return;
      if (i === failAfter) throw new FakeAiFailedError();
      yield findings[i];
    }

    await sleep(steps[findings.length], signal);
    if (signal?.aborted) return;
    if (failAfter === findings.length) throw new FakeAiFailedError();
  }

  private load(): Promise<Map<string, AiFinding[]>> {
    this.findingsById ??= readFile(this.documentsFile, 'utf8').then((raw) => {
      const documents = JSON.parse(raw) as SampleDocument[];
      return new Map(documents.map((doc) => [doc.id, doc.findings]));
    });
    return this.findingsById;
  }
}

/** Splits `total` into `parts` random positive pieces that add up to `total`. */
function randomSplit(total: number, parts: number, random: () => number): number[] {
  const weights = Array.from({ length: parts }, () => random() + Number.EPSILON);
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (w / sum) * total);
}

/**
 * Resolves after `ms`, or as soon as `signal` aborts. Whichever happens first, `done`
 * clears the timer AND removes the abort listener, so neither can outlive the call:
 * no timer keeps the process alive after an abort, and no listener accumulates on a
 * long-lived signal across the many sleeps of one review.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
  });
}
