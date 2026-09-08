import { expect, it } from 'vitest';
import type { Activity } from '../domain/model';
import { BackgroundWorkerHost } from './BackgroundWorkerHost';
import type { CommittedEventBatch } from './CommittedEventStream';
import { ManualScheduler } from './scheduler';

function batch(revision: number): CommittedEventBatch {
  const event: Activity = {
    id: `event-${revision}`,
    tick: revision,
    actorId: 'operator',
    type: 'robot.pause',
    entityId: 'R-001',
    details: 'Paused',
  };
  return { revision, events: [event] };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

it('retries a failed batch before processing the next revision', async () => {
  const clock = new ManualScheduler();
  const host = new BackgroundWorkerHost(clock);
  const handled: number[] = [];
  host.register({
    id: 'search-index',
    retryDelays: [25],
    handle(item) {
      handled.push(item.revision);
      if (handled.length === 1) throw new Error('index unavailable');
    },
  });

  host.enqueue(batch(1));
  host.enqueue(batch(2));
  clock.advance(0);
  await flush();
  expect(host.getSnapshot()[0]).toMatchObject({
    state: 'retrying',
    pendingBatches: 2,
    attempts: 1,
    lastError: 'index unavailable',
  });

  clock.advance(25);
  await flush();
  clock.advance(0);
  await flush();

  expect(handled).toEqual([1, 1, 2]);
  expect(host.getSnapshot()[0]).toEqual({
    id: 'search-index',
    state: 'idle',
    pendingBatches: 0,
    attempts: 0,
    lastProcessedRevision: 2,
  });
});

it('holds later batches after terminal failure until an explicit retry', async () => {
  const clock = new ManualScheduler();
  const host = new BackgroundWorkerHost(clock);
  let available = false;
  const handled: number[] = [];
  host.register({
    id: 'export',
    retryDelays: [],
    handle(item) {
      handled.push(item.revision);
      if (!available) throw new Error('export offline');
    },
  });
  host.enqueue(batch(3));
  host.enqueue(batch(4));
  clock.advance(0);
  await flush();

  expect(host.getSnapshot()[0]).toMatchObject({ state: 'failed', pendingBatches: 2 });
  available = true;
  expect(host.retry('export')).toBe(true);
  clock.advance(0);
  await flush();
  clock.advance(0);
  await flush();

  expect(handled).toEqual([3, 3, 4]);
  expect(host.getSnapshot()[0]).toMatchObject({ state: 'idle', lastProcessedRevision: 4 });
});

it('deduplicates queued and already processed revisions', async () => {
  const clock = new ManualScheduler();
  const host = new BackgroundWorkerHost(clock);
  const handled: number[] = [];
  host.register({
    id: 'alerts',
    handle(item) {
      handled.push(item.revision);
    },
  });

  host.enqueue(batch(1));
  host.enqueue(batch(1));
  clock.advance(0);
  await flush();
  host.enqueue(batch(1));
  clock.advance(0);
  await flush();

  expect(handled).toEqual([1]);
  expect(Object.isFrozen(host.getSnapshot())).toBe(true);
  expect(Object.isFrozen(host.getSnapshot()[0])).toBe(true);
});

it('validates retry configuration and cancels disposed scheduled work', async () => {
  const clock = new ManualScheduler();
  const host = new BackgroundWorkerHost(clock);
  expect(() => host.register({ id: 'invalid', retryDelays: [-1], handle() {} })).toThrow(
    'retry delays must be finite and nonnegative',
  );
  let calls = 0;
  const dispose = host.register({
    id: 'disposable',
    handle() {
      calls++;
    },
  });
  host.enqueue(batch(1));
  dispose();
  clock.advance(0);
  await flush();

  expect(calls).toBe(0);
  expect(host.getSnapshot()).toEqual([]);
});
