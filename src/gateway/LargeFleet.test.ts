import { expect, it } from 'vitest';
import { createLargeFleet } from '../test/largeFleet';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';
import { pageCollection } from '../application/collections';
it('preserves atomic and scoped behavior with 600 robots and 1000 warehouse jobs', async () => {
  const start = performance.now();
  const state = createLargeFleet();
  expect(Object.keys(state.robots)).toHaveLength(600);
  expect(Object.keys(state.jobs)).toHaveLength(1000);
  const clock = new ManualScheduler();
  const gateway = new FleetGateway(clock, state);
  const before = gateway.getSnapshot();
  const [first, second] = Object.keys(before.robots);
  const ticket = gateway.command(
    { id: 'scale-operator', role: 'administrator' },
    { type: 'robot.stop', id: first, expectedRevision: before.robots[first].revision },
  );
  clock.advance(250);
  await ticket.promise;
  expect(gateway.getSnapshot().robots[second]).toBe(before.robots[second]);
  expect(gateway.getSnapshot().robots[first].status).toBe('emergency-stopped');
  expect(pageCollection(Object.values(gateway.getSnapshot().jobs), 10, 25).items).toHaveLength(25);
  console.info(
    'Large fleet fixture and transaction: ' + Math.round(performance.now() - start) + 'ms',
  );
});
