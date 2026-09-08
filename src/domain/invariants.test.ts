import { expect, it } from 'vitest';
import { createSeed } from './seed';
import { inspectInvariants } from './invariants';
import { FleetGateway } from '../gateway/FleetGateway';
import { ManualScheduler } from '../gateway/scheduler';

it('validates the coherent seed and detects broken cross-domain references', () => {
  const state = createSeed();
  expect(inspectInvariants(state)).toEqual([]);
  state.robots['R-001'].activeMissionId = 'M-002';
  state.reservations['RES-001'].state = 'released';
  expect(inspectInvariants(state).map((entry) => entry.rule)).toEqual(
    expect.arrayContaining([
      'Active mission ownership must agree',
      'Attached charging reservation must be owned and unreleased',
    ]),
  );
});
it('releases completed active missions while retaining historical execution context', () => {
  const gateway = new FleetGateway(new ManualScheduler());
  gateway.advance(100);
  expect(inspectInvariants(gateway.getSnapshot())).toEqual([]);
});

it('detects orphan leases, maintenance and job dependencies', () => {
  const state = createSeed();
  state.leases['orphan'] = {
    id: 'orphan',
    revision: 1,
    robotId: 'missing',
    ownerId: 'a',
    expiresAt: 10,
    state: 'active',
  };
  Object.values(state.maintenance)[0].robotId = 'missing';
  Object.values(state.jobs)[0].dependsOn = ['missing'];
  const rules = inspectInvariants(state).map((entry) => entry.rule);
  expect(rules).toEqual(
    expect.arrayContaining([
      'Control lease robot must exist',
      'Maintenance robot must exist',
      'Job dependency must exist in the same facility',
    ]),
  );
});
