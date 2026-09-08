import { expect, it } from 'vitest';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';
import { newPlan, newStep, validatePlan } from '../domain/planning';
import { createSeed } from '../domain/seed';
function fixture() {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock);
  const plan = newPlan('PLAN-001', 'FAC-001', 'R-001');
  plan.steps = [{ ...newStep('travel'), zoneId: 'Z-010' }];
  return { clock, gateway, plan };
}
it('plan validation uses topology, charger availability and robot capabilities', () => {
  const { plan } = fixture(),
    state = createSeed();
  expect(validatePlan(state, plan).issues).toEqual([]);
  state.corridors['C-001'].open = false;
  state.corridors['C-002'].open = false;
  state.corridors['C-003'].open = false;
  expect(validatePlan(state, plan).issues.map((i) => i.message)).toContain(
    'Destination is unreachable through the current topology',
  );
  plan.steps = [
    { ...newStep('lift', 'pickup'), payloadKg: 1000 },
    { ...newStep('charge', 'charge'), chargerId: 'CHG-001' },
  ];
  state.chargers['CHG-001'].available = false;
  expect(validatePlan(state, plan).issues.map((i) => i.message)).toEqual(
    expect.arrayContaining([
      'Robot cannot handle this payload',
      'Choose an available charger in this facility',
    ]),
  );
});
it('detects dependency cycles, missing references and repeated step identities', () => {
  const { plan } = fixture();
  plan.steps = [
    { ...newStep('a', 'wait'), dependsOn: ['b'] },
    { ...newStep('b', 'wait'), dependsOn: ['a'] },
  ];
  expect(validatePlan(createSeed(), plan).issues.map((i) => i.message)).toContain(
    'Dependencies contain a cycle or missing reference',
  );
  plan.steps[1].id = 'a';
  expect(validatePlan(createSeed(), plan).issues.map((i) => i.message)).toContain(
    'Step identifiers must be unique and nonempty',
  );
});
it('parallel dependency durations use the longest branch', () => {
  const { plan } = fixture();
  plan.steps = [
    { ...newStep('a', 'wait'), seconds: 10 },
    { ...newStep('b', 'inspect'), seconds: 20 },
    { ...newStep('c', 'wait'), seconds: 5, dependsOn: ['a', 'b'] },
  ];
  expect(validatePlan(createSeed(), plan).durationSeconds).toBe(25);
});
it('saves immutable plans and rejects concurrent stale revisions atomically', async () => {
  const { clock, gateway, plan } = fixture();
  const first = gateway.command(
    { id: 'planner', role: 'fleet-manager' },
    { type: 'plan.save', id: plan.id, expectedRevision: 0, plan },
  );
  clock.advance(250);
  await first.promise;
  plan.title = 'Local edits';
  expect(gateway.getSnapshot().plans[plan.id].title).toBe('Dock transfer');
  const before = gateway.getSnapshot();
  const stale = gateway.command(
    { id: 'planner', role: 'fleet-manager' },
    { type: 'plan.save', id: plan.id, expectedRevision: 0, plan },
  );
  const rejected = expect(stale.promise).rejects.toMatchObject({ code: 'stale' });
  clock.advance(250);
  await rejected;
  expect(gateway.getSnapshot()).toBe(before);
  expect(before.activity.at(-1)?.changes?.some((c) => c.kind === 'plans')).toBe(true);
});
it('plan writes obey facility grants and current feasibility', async () => {
  const { clock, gateway, plan } = fixture();
  const ticket = gateway.command(
    { id: 'planner', role: 'fleet-manager', facilityIds: ['FAC-002'] },
    { type: 'plan.save', id: plan.id, expectedRevision: 0, plan },
  );
  const denied = expect(ticket.promise).rejects.toMatchObject({ code: 'forbidden' });
  clock.advance(250);
  await denied;
  expect(gateway.getSnapshot().plans).toEqual({});
});
it('asynchronous validation rejects changed operational inputs and supports cancellation', async () => {
  const { clock, gateway, plan } = fixture();
  const pending = gateway.validateMissionPlan(plan);
  const stale = expect(pending.promise).rejects.toMatchObject({ code: 'stale' });
  gateway.advance();
  clock.advance(250);
  await stale;
  const controller = new AbortController();
  const next = gateway.validateMissionPlan(plan, controller.signal);
  const cancelled = expect(next.promise).rejects.toMatchObject({ code: 'cancelled' });
  controller.abort();
  await cancelled;
});
