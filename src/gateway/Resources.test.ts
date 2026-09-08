import { expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import {
  applyResource,
  resourceOwners,
  synchronizeResources,
  reserveMissionResources,
} from '../domain/resources';
import { applyCommand } from '../domain/transactions';
const resourceId = 'RES-F-001-1';
function request(
  state: ReturnType<typeof createSeed>,
  robotId: string,
  priority = 3,
  duration = 100,
) {
  applyResource(state, {
    type: 'resource.request',
    id: resourceId,
    expectedRevision: state.resources[resourceId].revision,
    robotId,
    priority,
    duration,
  });
}
it('exclusive ownership queues a second mission and promotes it on release', () => {
  const state = createSeed();
  request(state, 'R-004');
  request(state, 'R-006');
  expect(resourceOwners(state, resourceId).map((r) => r.robotId)).toEqual(['R-004']);
  expect(state.missions['M-006'].pauseReason).toBe('Resource contention');
  const owner = resourceOwners(state, resourceId)[0];
  applyResource(state, {
    type: 'resource.release',
    id: owner.id,
    expectedRevision: owner.revision,
  });
  expect(resourceOwners(state, resourceId).map((r) => r.robotId)).toEqual(['R-006']);
  expect(state.missions['M-006'].status).toBe('running');
});
it('queued priority determines ownership without preempting a current owner', () => {
  const state = createSeed();
  request(state, 'R-004');
  request(state, 'R-006', 2);
  request(state, 'R-008', 5);
  const owner = resourceOwners(state, resourceId)[0];
  applyResource(state, {
    type: 'resource.release',
    id: owner.id,
    expectedRevision: owner.revision,
  });
  expect(resourceOwners(state, resourceId)[0].robotId).toBe('R-008');
});
it('expiration removes ownership and prevents execution with an expired lease', () => {
  const state = createSeed();
  request(state, 'R-004', 3, 1);
  state.tick = 1;
  synchronizeResources(state);
  expect(resourceOwners(state, resourceId)).toEqual([]);
  expect(state.missions['M-004'].status).toBe('paused');
  expect(Object.values(state.resourceReservations)[0].state).toBe('expired');
});
it('maintenance and emergency stop release shared facility resources', () => {
  const state = createSeed();
  request(state, 'R-004');
  applyCommand(
    state,
    { id: 'admin', role: 'administrator' },
    { type: 'maintenance.start', id: 'SVC-R-004', expectedRevision: 1 },
  );
  expect(resourceOwners(state, resourceId)).toEqual([]);
  request(state, 'R-006');
  applyCommand(
    state,
    { id: 'admin', role: 'administrator' },
    { type: 'robot.stop', id: 'R-006', expectedRevision: state.robots['R-006'].revision },
  );
  expect(resourceOwners(state, resourceId)).toEqual([]);
});
it('multi-resource acquisition is atomic and avoids partial ownership deadlocks', () => {
  const state = createSeed(),
    second = 'RES-F-001-2';
  reserveMissionResources(state, state.robots['R-004'], 'M-004', [second], 3);
  reserveMissionResources(state, state.robots['R-006'], 'M-006', [resourceId, second], 3);
  expect(resourceOwners(state, resourceId)).toEqual([]);
  expect(resourceOwners(state, second)[0].robotId).toBe('R-004');
});
it('unavailable resources revoke ownership and invalidate operational topology', () => {
  const state = createSeed();
  request(state, 'R-004');
  applyResource(state, {
    type: 'resource.set',
    id: resourceId,
    expectedRevision: state.resources[resourceId].revision,
    available: false,
  });
  expect(resourceOwners(state, resourceId)).toEqual([]);
  expect(state.facilities['FAC-001'].topologyRevision).toBe(2);
  expect(state.missions['M-004'].pauseReason).toBe('Resource contention');
});
it('resource requests reject cross-facility robots and unavailable maintenance robots', () => {
  const state = createSeed();
  expect(() => request(state, 'R-031')).toThrow('share a facility');
  state.maintenance['SVC-R-004'].status = 'verification';
  expect(() => request(state, 'R-004')).toThrow('unavailable');
});

it('closing a narrow-corridor resource pauses affected traffic and excludes that edge', () => {
  const state = createSeed(),
    id = 'RES-F-001-3';
  applyResource(state, { type: 'resource.set', id, expectedRevision: 1, available: false });
  expect(state.missions['M-004'].status).toBe('paused');
  expect(state.routes['RT-004'].state).toBe('invalid');
});
