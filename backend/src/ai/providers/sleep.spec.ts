import { getEventListeners } from 'node:events';
import { sleep } from './fake-ai.provider.js';

describe('sleep', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves after the given time', async () => {
    let resolved = false;
    void sleep(1_000).then(() => (resolved = true));

    await vi.advanceTimersByTimeAsync(999);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(resolved).toBe(true);
  });

  it('leaves no timer and no abort listener behind once it resolves', async () => {
    const controller = new AbortController();
    const pending = sleep(1_000, controller.signal);
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(1_000);
    await pending;

    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resolves early on abort and clears the timer and the listener', async () => {
    const controller = new AbortController();
    const pending = sleep(60_000, controller.signal);

    controller.abort();
    await pending;

    expect(vi.getTimerCount()).toBe(0);
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  });

  it('resolves immediately, without a timer, when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await sleep(60_000, controller.signal);

    expect(vi.getTimerCount()).toBe(0);
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  });

  it('does not accumulate listeners across many sleeps on the same signal', async () => {
    const controller = new AbortController();

    for (let i = 0; i < 50; i++) {
      const pending = sleep(10, controller.signal);
      await vi.advanceTimersByTimeAsync(10);
      await pending;
    }

    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
