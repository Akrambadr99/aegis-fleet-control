import { expect, it } from 'vitest';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

it('requires an unrestricted administrator to retry a failed global worker', async () => {
  const clock = new ManualScheduler();
  const gateway = new FleetGateway(clock);
  let available = false;
  gateway.registerBackgroundWorker({
    id: 'global-export',
    retryDelays: [],
    handle() {
      if (!available) throw new Error('offline');
    },
  });
  const command = gateway.command(
    { id: 'operator', role: 'administrator' },
    { type: 'robot.stop', id: 'R-001', expectedRevision: 1 },
  );
  clock.advance(250);
  await command.promise;
  await flush();
  expect(
    gateway.workers.getSnapshot().find((worker) => worker.id === 'global-export'),
  ).toMatchObject({ state: 'failed', pendingBatches: 1 });

  expect(() =>
    gateway.retryBackgroundWorker({ id: 'viewer', role: 'viewer' }, 'global-export'),
  ).toThrow('Global administrator access is required');
  expect(() =>
    gateway.retryBackgroundWorker(
      { id: 'scoped', role: 'administrator', facilityIds: ['FAC-001'] },
      'global-export',
    ),
  ).toThrow('Global administrator access is required');
  expect(
    gateway.workers.getSnapshot().find((worker) => worker.id === 'global-export'),
  ).toMatchObject({ state: 'failed', pendingBatches: 1 });

  available = true;
  gateway.retryBackgroundWorker({ id: 'admin', role: 'administrator' }, 'global-export');
  clock.advance(0);
  await flush();
  expect(
    gateway.workers.getSnapshot().find((worker) => worker.id === 'global-export'),
  ).toMatchObject({ state: 'idle', pendingBatches: 0, lastProcessedRevision: 2 });
});
