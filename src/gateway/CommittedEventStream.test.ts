import { expect, it } from 'vitest';
import type { Activity } from '../domain/model';
import { CommittedEventStream } from './CommittedEventStream';

function event(id: string): Activity {
  return {
    id,
    tick: 1,
    actorId: 'operator',
    type: 'robot.pause',
    entityId: 'R-001',
    details: 'Paused',
  };
}

it('publishes detached immutable post-commit batches and retains bounded history', () => {
  const stream = new CommittedEventStream();
  const source = [event('EV-1')];
  let delivered;
  stream.subscribe((batch) => (delivered = batch));

  stream.publish(2, source);
  source[0].details = 'Changed by caller';

  expect(delivered).toBe(stream.getBatches()[0]);
  expect(stream.getBatches()[0].events[0].details).toBe('Paused');
  expect(Object.isFrozen(stream.getBatches()[0].events[0])).toBe(true);

  for (let revision = 3; revision < 260; revision++)
    stream.publish(revision, [event(`EV-${revision}`)]);
  expect(stream.getBatches()).toHaveLength(256);
  expect(stream.getBatches()[0].revision).toBe(4);
});

it('isolates subscriber failures and preserves order across reentrant publication', () => {
  const stream = new CommittedEventStream();
  const revisions: number[] = [];
  stream.subscribe((batch) => {
    revisions.push(batch.revision);
    if (batch.revision === 1) stream.publish(2, [event('EV-2')]);
  });
  stream.subscribe(() => {
    throw new Error('worker unavailable');
  });

  expect(() => stream.publish(1, [event('EV-1')])).not.toThrow();

  expect(revisions).toEqual([1, 2]);
  expect(stream.getDeliveryFailures()).toEqual([
    { revision: 1, eventIds: ['EV-1'], message: 'worker unavailable' },
    { revision: 2, eventIds: ['EV-2'], message: 'worker unavailable' },
  ]);
});
