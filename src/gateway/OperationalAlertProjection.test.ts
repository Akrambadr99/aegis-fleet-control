import { expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { FleetGateway } from './FleetGateway';
import { OperationalAlertProjection } from './OperationalAlertProjection';
import { ManualScheduler } from './scheduler';

it('projects committed alerts once and applies facility scope at read time', async () => {
  const clock = new ManualScheduler();
  const gateway = new FleetGateway(clock, createSeed());
  let notifications = 0;
  gateway.alerts.subscribe(() => notifications++);

  const ticket = gateway.command(
    { id: 'operator', role: 'administrator' },
    { type: 'robot.stop', id: 'R-001', expectedRevision: 1 },
  );
  clock.advance(250);
  await ticket.promise;

  expect(gateway.alerts.getSnapshot()).toHaveLength(1);
  expect(gateway.alerts.getSnapshot()[0]).toMatchObject({
    entityId: 'R-001',
    facilityId: 'FAC-001',
    severity: 'critical',
  });
  expect(gateway.alerts.forActor({ id: 'all', role: 'viewer' })).toHaveLength(1);
  expect(
    gateway.alerts.forActor({ id: 'limited', role: 'viewer', facilityIds: ['FAC-002'] }),
  ).toEqual([]);
  expect(notifications).toBe(1);
});

it('does not project failed commands that never commit an event', async () => {
  const clock = new ManualScheduler();
  const gateway = new FleetGateway(clock);
  const ticket = gateway.command(
    { id: 'operator', role: 'administrator' },
    { type: 'robot.stop', id: 'R-001', expectedRevision: 0 },
  );
  const rejected = expect(ticket.promise).rejects.toMatchObject({ code: 'stale' });
  clock.advance(250);
  await rejected;

  expect(gateway.alerts.getSnapshot()).toEqual([]);
});

it('bootstraps a bounded immutable window from durable activity', () => {
  const state = createSeed();
  state.activity = Array.from({ length: 205 }, (_, index) => ({
    id: `alert-${index}`,
    tick: index,
    actorId: 'operator',
    type: 'robot.stop' as const,
    entityId: 'R-001',
    details: 'Stopped',
  }));

  const projection = new OperationalAlertProjection(state);

  expect(projection.getSnapshot()).toHaveLength(200);
  expect(projection.getSnapshot()[0].id).toBe('alert-5');
  expect(Object.isFrozen(projection.getSnapshot())).toBe(true);
  expect(Object.isFrozen(projection.getSnapshot()[0])).toBe(true);
});
