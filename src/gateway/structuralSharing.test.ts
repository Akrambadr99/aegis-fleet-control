import { expect, it } from 'vitest';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';
it('keeps unaffected canonical collections and entities referentially stable', async () => {
  const clock = new ManualScheduler();
  const gateway = new FleetGateway(clock);
  const before = gateway.getSnapshot();
  const ticket = gateway.command(
    { id: 'a', role: 'administrator' },
    { type: 'robot.stop', id: 'R-001', expectedRevision: 1 },
  );
  clock.advance(250);
  await ticket.promise;
  const after = gateway.getSnapshot();
  expect(after.facilities).toBe(before.facilities);
  expect(after.robots['R-002']).toBe(before.robots['R-002']);
  expect(after.robots['R-001']).not.toBe(before.robots['R-001']);
  expect(Object.isFrozen(after.robots['R-001'])).toBe(true);
});
