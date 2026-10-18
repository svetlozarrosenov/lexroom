import { FakeAiFailedError, FakeAiProvider } from './fake-ai.provider.js';
import type { AiFinding } from '../interfaces/ai-provider.interface.js';

const NDA = '639fb780-cfdf-4393-bf6e-6a330940b21e'; // 3 findings
const CONSULTING = '077070a7-519b-411e-a466-3c97db7f07ff'; // 0 findings
const FRANCHISE = '61a3bea4-f6cf-4854-92b6-671ae1349309'; // 18 findings
const SAMPLES = '../samples/documents.json';

/** random() is drawn as: fails?, fail-after roll, duration roll, then one weight per step. */
function scripted(rolls: { fail?: boolean; failAfter?: number; duration?: number }) {
  const head = [rolls.fail ? 0 : 0.99, rolls.failAfter ?? 0, rolls.duration ?? 0.5];
  let i = 0;
  return () => (i < head.length ? head[i++] : 0.5);
}

/** Records requested delays instead of waiting. */
function instantClock() {
  const delays: number[] = [];
  return {
    delays,
    sleep: async (ms: number) => {
      delays.push(ms);
    },
    total: () => delays.reduce((a, b) => a + b, 0),
  };
}

async function collect(iterable: AsyncIterable<AiFinding>) {
  const items: AiFinding[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}

function provider(options: ConstructorParameters<typeof FakeAiProvider>[1]) {
  return new FakeAiProvider(SAMPLES, options);
}

describe('FakeAiProvider', () => {
  it('yields the findings listed for the document, in order, one per step', async () => {
    const clock = instantClock();
    const ai = provider({ random: scripted({}), sleep: clock.sleep });

    const findings = await collect(ai.review(NDA));

    expect(findings.map((f) => f.clause)).toEqual(['5.1', '3.2', null]);
    expect(findings[0]).toMatchObject({ title: 'Liability is not capped', severity: 'high' });
    expect(clock.delays).toHaveLength(4); // 3 findings + completion
  });

  it('spreads the review over 5 to 30 seconds in total', async () => {
    for (const duration of [0, 0.37, 0.999]) {
      const clock = instantClock();
      await collect(provider({ random: scripted({ duration }), sleep: clock.sleep }).review(FRANCHISE));

      expect(clock.delays).toHaveLength(19);
      expect(clock.total()).toBeGreaterThanOrEqual(5_000);
      expect(clock.total()).toBeLessThanOrEqual(30_000);
      expect(clock.total()).toBeCloseTo(5_000 + duration * 25_000, 5);
    }
  });

  it('uses random, not equal, intervals between findings', async () => {
    const clock = instantClock();
    // Fixed outcome (no failure, mid duration), random weights for the steps.
    const head = [0.99, 0, 0.5];
    let i = 0;
    const random = () => (i < head.length ? head[i++] : Math.random());
    await collect(provider({ random, sleep: clock.sleep }).review(FRANCHISE));

    expect(new Set(clock.delays.map((d) => Math.round(d))).size).toBeGreaterThan(1);
  });

  it('waits the normal duration even for a document with no findings', async () => {
    const clock = instantClock();

    expect(await collect(provider({ random: scripted({}), sleep: clock.sleep }).review(CONSULTING))).toEqual([]);
    expect(clock.delays).toHaveLength(1);
    expect(clock.total()).toBeGreaterThanOrEqual(5_000);
  });

  it('fails with an error after returning some of the findings', async () => {
    // failAfter roll 0.5 with 3 findings -> floor(0.5 * 4) = 2 findings before failing
    const ai = provider({ random: scripted({ fail: true, failAfter: 0.5 }), sleep: instantClock().sleep });

    const received: AiFinding[] = [];
    await expect(async () => {
      for await (const f of ai.review(NDA)) received.push(f);
    }).rejects.toBeInstanceOf(FakeAiFailedError);

    expect(received.map((f) => f.clause)).toEqual(['5.1', '3.2']);
  });

  it('can fail before returning any finding', async () => {
    const ai = provider({ random: scripted({ fail: true, failAfter: 0 }), sleep: instantClock().sleep });

    await expect(collect(ai.review(NDA))).rejects.toBeInstanceOf(FakeAiFailedError);
  });

  it('can fail at the very end, after returning every finding', async () => {
    const ai = provider({ random: scripted({ fail: true, failAfter: 0.99 }), sleep: instantClock().sleep });

    const received: AiFinding[] = [];
    await expect(async () => {
      for await (const f of ai.review(NDA)) received.push(f);
    }).rejects.toBeInstanceOf(FakeAiFailedError);

    expect(received).toHaveLength(3);
  });

  it('fails about 1 time in 5 over many reviews', async () => {
    const ai = provider({ sleep: instantClock().sleep });
    const runs = 2_000;
    let failures = 0;

    for (let i = 0; i < runs; i++) {
      try {
        await collect(ai.review(NDA));
      } catch (e) {
        if (!(e instanceof FakeAiFailedError)) throw e;
        failures++;
      }
    }

    expect(failures / runs).toBeGreaterThan(0.16);
    expect(failures / runs).toBeLessThan(0.24);
  });

  it('stops quietly once the signal is aborted', async () => {
    const controller = new AbortController();
    const ai = provider({
      random: scripted({}),
      sleep: async () => {
        controller.abort();
      },
    });

    expect(await collect(ai.review(NDA, controller.signal))).toEqual([]);
  });

  it('fails for a document it does not know', async () => {
    await expect(collect(provider({ sleep: instantClock().sleep }).review('nope'))).rejects.toThrow(
      /Unknown document/,
    );
  });
});
