import { expect, it } from 'vitest';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';
import { createSeed } from '../domain/seed';
import { validateRule } from '../domain/automation';
it('enabled reroute rules consume actual corridor events and preserve paused execution', async () => {
  const state = createSeed();
  state.automationRules['AUTO-ROUTE'].enabled = true;
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock, state);
  const ticket = gateway.command(
    { id: 'admin', role: 'administrator' },
    { type: 'corridor.set', id: 'C-001', expectedRevision: 1, open: false },
  );
  clock.advance(250);
  await ticket.promise;
  expect(gateway.getSnapshot().routes['RT-004'].state).toBe('valid');
  expect(gateway.getSnapshot().missions['M-004'].status).toBe('paused');
  expect(
    gateway
      .getSnapshot()
      .automationRuns.some((r) => r.robotId === 'R-004' && r.status === 'confirmed'),
  ).toBe(true);
});
it('disabled rules never change operational events', async () => {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock);
  const ticket = gateway.command(
    { id: 'admin', role: 'administrator' },
    { type: 'corridor.set', id: 'C-001', expectedRevision: 1, open: false },
  );
  clock.advance(250);
  await ticket.promise;
  expect(gateway.getSnapshot().routes['RT-004'].state).toBe('invalid');
  expect(gateway.getSnapshot().automationRuns).toEqual([]);
});
it('low-battery events schedule a real charger reservation', () => {
  const state = createSeed();
  state.robots['R-004'].battery = 20.05;
  state.automationRules['AUTO-CHARGE'].enabled = true;
  const gateway = new FleetGateway(new ManualScheduler(), state);
  gateway.advance();
  const robot = gateway.getSnapshot().robots['R-004'];
  expect(robot.chargerReservationId).not.toBeNull();
  expect(gateway.getSnapshot().reservations[robot.chargerReservationId!].state).toBe('queued');
});
it('cooldown prevents repeated action loops and failure is recorded without partial mutation', async () => {
  const state = createSeed();
  state.automationRules['AUTO-ROUTE'].enabled = true;
  state.automationRules['AUTO-ROUTE'].owner = { id: 'viewer', role: 'viewer' };
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock, state);
  const ticket = gateway.command(
    { id: 'admin', role: 'administrator' },
    { type: 'corridor.set', id: 'C-001', expectedRevision: 1, open: false },
  );
  clock.advance(250);
  await ticket.promise;
  expect(gateway.getSnapshot().routes['RT-004'].state).toBe('invalid');
  expect(gateway.getSnapshot().automationRuns.find((r) => r.robotId === 'R-004')?.status).toBe(
    'failed',
  );
  expect(gateway.getSnapshot().automationRuns.length).toBeLessThan(10);
});
it('rule validation and testing do not modify the shared state', async () => {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock);
  const before = gateway.getSnapshot(),
    input = before.automationRules['AUTO-ROUTE'];
  expect(validateRule(before, { ...input, cooldownTicks: 0 })).toContain(
    'Cooldown must be 1–3600 seconds',
  );
  const test = gateway.validateAutomation(input, before.activity[0].id);
  clock.advance(250);
  expect((await test.promise).targets[0].matched).toBe(false);
  expect(gateway.getSnapshot()).toBe(before);
});
it('saving rules obeys revisions and facility grants', async () => {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock);
  const rule = gateway.getSnapshot().automationRules['AUTO-ROUTE'];
  const request = gateway.command(
    { id: 'limited', role: 'fleet-manager', facilityIds: ['FAC-002'] },
    { type: 'automation.save', id: rule.id, expectedRevision: 1, input: rule },
  );
  const denied = expect(request.promise).rejects.toMatchObject({ code: 'forbidden' });
  clock.advance(250);
  await denied;
});

it('escalation revokes manual control before the robot can receive further motion', async () => {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock);
  const actor = { id: 'admin', role: 'administrator' as const };
  const acquire = gateway.command(actor, {
    type: 'control.acquire',
    id: 'R-004',
    expectedRevision: 1,
    duration: 30,
  });
  clock.advance(250);
  await acquire.promise;
  const fault = gateway.command(actor, {
    type: 'fault.escalate',
    id: 'R-004',
    expectedRevision: gateway.getSnapshot().robots['R-004'].revision,
    message: 'Repeated execution failure',
  });
  clock.advance(250);
  await fault.promise;
  expect(gateway.getSnapshot().robots['R-004'].controlSessionId).toBeNull();
  expect(gateway.getSnapshot().robots['R-004'].status).toBe('paused');
});
