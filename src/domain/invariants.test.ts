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
