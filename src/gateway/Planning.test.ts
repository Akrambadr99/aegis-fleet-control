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
it('asynchronous feasibility includes captured operator permissions', async () => {
  const { clock, gateway, plan } = fixture();
  const actor = { id: 'limited', role: 'fleet-manager' as const, facilityIds: ['FAC-002'] };
  const request = gateway.validateMissionPlan(plan, undefined, actor);
  actor.facilityIds.push('FAC-001');
  clock.advance(250);
  expect((await request.promise).issues.map((issue) => issue.message)).toContain(
    'This facility is outside your control scope',
  );
});
it('validates explicit branch controls and derives the longest joined path', () => {
  const { plan } = fixture(),
    state = createSeed();
  plan.steps = [
    { ...newStep('gate', 'conditional-branch'), condition: 'battery-low' },
    { ...newStep('fork', 'parallel-branch'), dependsOn: ['gate'] },
    { ...newStep('a', 'inspect'), seconds: 20, dependsOn: ['fork'] },
    { ...newStep('b', 'wait'), seconds: 30, dependsOn: ['fork'] },
    { ...newStep('join', 'wait'), seconds: 5, dependsOn: ['a', 'b'] },
  ];
  expect(validatePlan(state, plan)).toMatchObject({
    issues: [],
    durationSeconds: 35,
    order: ['gate', 'fork', 'a', 'b', 'join'],
  });
  plan.steps[0].condition = 'always';
  expect(validatePlan(state, plan).issues.map((issue) => issue.message)).toContain(
    'Choose a condition for this branch',
  );
  plan.steps[3].dependsOn = [];
  expect(validatePlan(state, plan).issues.map((issue) => issue.message)).toContain(
    'A parallel branch needs at least two dependent steps',
  );
  plan.steps[1].dependsOn = [];
  expect(validatePlan(state, plan).issues.map((issue) => issue.message)).toContain(
    'A conditional branch needs a dependent step',
  );
});
it.each([
  ['dock', 'dock'],
  ['open-door', 'door'],
  ['call-elevator', 'elevator'],
] as const)('%s requires the matching available facility resource', (kind, resourceKind) => {
  const { plan } = fixture(),
    state = createSeed();
  const resource = Object.values(state.resources).find(
    (entry) => entry.facilityId === plan.facilityId && entry.kind === resourceKind,
  )!;
  plan.steps = [{ ...newStep('use', kind), resourceId: resource.id, seconds: 15 }];
  expect(validatePlan(state, plan).issues).toEqual([]);
  resource.available = false;
  expect(validatePlan(state, plan).issues.map((issue) => issue.message)).toContain(
    'Choose an available resource in this facility',
  );
  resource.available = true;
  resource.kind = 'inspection-station';
  expect(validatePlan(state, plan).issues.map((issue) => issue.message)).toContain(
    'This action requires a ' + resourceKind + ' resource',
  );
  resource.facilityId = 'FAC-002';
  expect(validatePlan(state, plan).issues.map((issue) => issue.message)).toContain(
    'Choose an available resource in this facility',
  );
});
it('retains immutable attributed revisions and ignores client ownership spoofing', async () => {
  const { clock, gateway, plan } = fixture();
  async function save(actorId: string, expectedRevision: number) {
    const ticket = gateway.command(
      { id: actorId, role: 'fleet-manager' },
      { type: 'plan.save', id: plan.id, expectedRevision, plan },
    );
    clock.advance(250);
    return ticket.promise;
  }
  plan.ownerId = 'spoofed';
  await save('creator', 0);
  const first = Object.values(gateway.getSnapshot().planRevisions)[0];
  plan.title = 'Revised dock transfer';
  plan.steps[0].label = 'New label';
  gateway.advance();
  await save('reviewer', 1);
  const state = gateway.getSnapshot();
  expect(state.plans[plan.id].ownerId).toBe('creator');
  expect(Object.values(state.planRevisions)).toHaveLength(2);
  expect(first.plan.title).toBe('Dock transfer');
  expect(first.plan.steps[0].label).toBe('');
  expect(Object.isFrozen(first.plan.steps[0])).toBe(true);
  expect(Object.values(state.planRevisions)[1]).toMatchObject({
    savedBy: 'reviewer',
    savedAtTick: 1,
    revision: 2,
  });
  await expect(save('creator', 1)).rejects.toMatchObject({ code: 'stale' });
  expect(gateway.getSnapshot()).toBe(state);
  expect(state.activity.at(-1)?.changes?.some((change) => change.kind === 'planRevisions')).toBe(
    true,
  );
});
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
