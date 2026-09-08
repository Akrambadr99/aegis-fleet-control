import { expect, it } from 'vitest';
import { FleetGateway } from '../gateway/FleetGateway';
import { ManualScheduler } from '../gateway/scheduler';
import { defaultConfiguration } from './configuration';
it('rejects disabled routing before any canonical state change and captures configuration', async () => {
  const clock = new ManualScheduler();
  const config = { ...defaultConfiguration, advancedRouting: false };
  const gateway = new FleetGateway(clock, undefined, config);
  config.advancedRouting = true;
  const before = gateway.getSnapshot();
  const ticket = gateway.command(
    { id: 'a', role: 'administrator' },
    { type: 'robot.reroute', id: 'R-001', expectedRevision: 1 },
  );
  const result = expect(ticket.promise).rejects.toMatchObject({ code: 'forbidden' });
  clock.advance(250);
  await result;
  expect(gateway.getSnapshot()).toBe(before);
});

it('applies disabled capabilities to automated commands as well as operator commands', async () => {
  const seed = new FleetGateway().getSnapshot();
  const state = structuredClone(seed);
  state.automationRules['AUTO-ROUTE'].enabled = true;
  const clock = new ManualScheduler();
  const gateway = new FleetGateway(clock, state, {
    ...defaultConfiguration,
    advancedRouting: false,
  });
  const ticket = gateway.command(
    { id: 'a', role: 'administrator' },
    { type: 'corridor.set', id: 'C-001', expectedRevision: 1, open: false },
  );
  clock.advance(250);
  await ticket.promise;
  expect(gateway.getSnapshot().routes['RT-004'].state).toBe('invalid');
  expect(gateway.getSnapshot().automationRuns.some((run) => run.status === 'failed')).toBe(true);
});

it('returns partial operation results and preserves causal attribution for failed follow-ups', async () => {
  const state = structuredClone(new FleetGateway().getSnapshot());
  state.automationRules['AUTO-ROUTE'].enabled = true;
  state.automationRules['AUTO-ROUTE'].owner = { id: 'viewer', role: 'viewer' };
  const clock = new ManualScheduler();
  const gateway = new FleetGateway(clock, state);
  const ticket = gateway.command(
    { id: 'a', role: 'administrator' },
    { type: 'corridor.set', id: 'C-001', expectedRevision: 1, open: false },
  );
  clock.advance(250);
  const result = await ticket.promise;
  expect(result.outcome).toBe('partial');
  expect(result.failures.length).toBeGreaterThan(0);
  expect(result.affectedEntities).toContain('C-001');
  const events = gateway
    .getSnapshot()
    .activity.filter((event) => event.operationId === result.operationId);
  const root = events.find((event) => event.type === 'corridor.set')!;
  expect(events.find((event) => event.type === 'automation.failed')?.causationId).toBe(root.id);
  expect(events.every((event) => event.correlationId === result.correlationId)).toBe(true);
});
