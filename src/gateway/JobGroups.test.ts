import { expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { applyJobGroup } from '../domain/jobGroups';
import { applyJob } from '../domain/jobs';
import { assertInvariants } from '../domain/invariants';
import { migrateSnapshot, schemaVersion } from '../domain/snapshots';
import { buildSearchIndex } from '../application/search';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';
const actor = { id: 'dispatcher', role: 'fleet-manager' as const };
function grouped() {
  const state = createSeed(),
    robot = state.robots['R-004'];
  robot.status = 'idle';
  robot.activeMissionId = null;
  robot.battery = 95;
  robot.position = { ...state.navigationNodes['F-001-OUT'].position };
  applyJobGroup(
    state,
    {
      type: 'job-group.create',
      id: 'WAVE-1',
      expectedRevision: 0,
      facilityId: 'FAC-001',
      title: 'Morning outbound',
      jobs: ['JOB-001', 'JOB-002'].map((id) => ({ id, expectedRevision: 1 })),
    },
    actor.id,
  );
  return state;
}
it('group creation preserves canonical membership and exposes a scoped search destination', () => {
  const state = grouped();
  expect(state.jobs['JOB-001']).toMatchObject({ groupId: 'WAVE-1', revision: 2 });
  expect(state.jobGroups['WAVE-1']).toMatchObject({
    jobIds: ['JOB-001', 'JOB-002'],
    createdBy: actor.id,
  });
  expect(buildSearchIndex(state).find((entry) => entry.id === 'WAVE-1')?.href).toBe(
    '/scheduler?facility=FAC-001&jobGroup=WAVE-1',
  );
  assertInvariants(state);
  state.jobs['JOB-001'].groupId = 'missing';
  expect(() => assertInvariants(state)).toThrow('membership must agree');
});
it.each([true, false])(
  'holding a group affects only assignments that settle after the hold: %s',
  async (holdFirst) => {
    const state = grouped(),
      clock = new ManualScheduler(),
      gateway = new FleetGateway(clock, state);
    gateway.requests.plan({ delay: holdFirst ? 300 : 50 }, { delay: holdFirst ? 50 : 300 });
    const assignment = gateway.command(actor, {
      type: 'job.assign',
      id: 'JOB-001',
      expectedRevision: 2,
      units: 1,
      reason: '',
    });
    const hold = gateway.command(actor, {
      type: 'job-group.set',
      id: 'WAVE-1',
      expectedRevision: 1,
      status: 'held',
      reason: 'Dock inspection',
    });
    const result = assignment.promise.then(
      () => 'assigned',
      (error: Error) => error.message,
    );
    clock.advance(350);
    await hold.promise;
    expect(await result).toEqual(
      holdFirst ? expect.stringContaining('Dispatch group is not released') : 'assigned',
    );
    const current = gateway.getSnapshot();
    expect(current.jobGroups['WAVE-1'].status).toBe('held');
    expect(current.jobs['JOB-001'].status).toBe(holdFirst ? 'queued' : 'assigned');
    if (!holdFirst)
      expect(current.missions[current.jobs['JOB-001'].missionId!].status).toBe('running');
    const event = current.activity.find((entry) => entry.type === 'job-group.set');
    expect(event?.changes?.find((change) => change.kind === 'jobGroups')?.entityId).toBe('WAVE-1');
  },
);
it('a group closes only after every job is terminal and cannot be reopened', () => {
  const state = grouped();
  const close = {
    type: 'job-group.set' as const,
    id: 'WAVE-1',
    expectedRevision: 1,
    status: 'closed' as const,
    reason: 'Wave finished',
  };
  expect(() => applyJobGroup(state, close, actor.id)).toThrow('Complete or cancel every job');
  for (const id of ['JOB-001', 'JOB-002'])
    applyJob(
      state,
      {
        type: 'job.cancel',
        id,
        expectedRevision: state.jobs[id].revision,
        reason: 'Customer withdrawal',
      },
      actor.id,
    );
  applyJobGroup(state, close, actor.id);
  assertInvariants(state);
  expect(() =>
    applyJobGroup(state, { ...close, expectedRevision: 2, status: 'ready' }, actor.id),
  ).toThrow('Closed dispatch groups');
});
it('conflicting group membership is rejected without partial changes', async () => {
  const state = grouped(),
    clock = new ManualScheduler(),
    gateway = new FleetGateway(clock, state),
    before = gateway.getSnapshot();
  const ticket = gateway.command(actor, {
    type: 'job-group.create',
    id: 'WAVE-2',
    expectedRevision: 0,
    facilityId: 'FAC-001',
    title: 'Duplicate grouping',
    jobs: [{ id: 'JOB-001', expectedRevision: 2 }],
  });
  const failure = expect(ticket.promise).rejects.toMatchObject({ code: 'conflict' });
  clock.advance(250);
  await failure;
  expect(gateway.getSnapshot()).toBe(before);
});
it('group commands enforce facility scope and preserve the original state on denial', async () => {
  const state = grouped(),
    clock = new ManualScheduler(),
    gateway = new FleetGateway(clock, state),
    before = gateway.getSnapshot();
  const ticket = gateway.command(
    { ...actor, facilityIds: ['FAC-002'] },
    {
      type: 'job-group.set',
      id: 'WAVE-1',
      expectedRevision: 1,
      status: 'held',
      reason: 'Outside scope',
    },
  );
  const failure = expect(ticket.promise).rejects.toMatchObject({ code: 'forbidden' });
  clock.advance(250);
  await failure;
  expect(gateway.getSnapshot()).toBe(before);
});
it('version-one snapshots gain an empty group table without altering their source', () => {
  const original = createSeed();
  const { jobGroups: _groups, ...legacy } = original;
  expect(_groups).toEqual({});
  const migrated = migrateSnapshot({
    schemaVersion: 1,
    fixtureVersion: 1,
    state: legacy as typeof original,
  });
  expect(migrated.schemaVersion).toBe(schemaVersion);
  expect(migrated.state.jobGroups).toEqual({});
  expect('jobGroups' in legacy).toBe(false);
});
