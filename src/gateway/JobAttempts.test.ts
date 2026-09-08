import { expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { applyJob, synchronizeJobs } from '../domain/jobs';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';

function assigned() {
  const state = createSeed(),
    robot = state.robots['R-004'];
  robot.status = 'idle';
  robot.activeMissionId = null;
  robot.battery = 95;
  robot.position = { ...state.navigationNodes['F-001-OUT'].position };
  applyJob(
    state,
    { type: 'job.assign', id: 'JOB-001', expectedRevision: 1, units: 2, reason: '' },
    'dispatcher',
  );
  return state;
}
it('release returns work to the queue and retry keeps the attributed attempt history', () => {
  const state = assigned(),
    job = state.jobs['JOB-001'],
    firstMission = job.missionId!;
  applyJob(
    state,
    {
      type: 'job.release',
      id: job.id,
      expectedRevision: job.revision,
      reason: 'Loading bay rescheduled',
    },
    'supervisor',
  );
  expect(job).toMatchObject({
    status: 'queued',
    completedUnits: 0,
    assignedUnits: 0,
    robotId: null,
    missionId: null,
  });
  expect(job.attempts?.[0]).toMatchObject({
    missionId: firstMission,
    units: 2,
    assignedBy: 'dispatcher',
    outcome: 'released',
    endedBy: 'supervisor',
    endReason: 'Loading bay rescheduled',
  });
  expect(state.routes[state.missions[firstMission].routeId].reservationState).toBe('released');
  const historical = structuredClone(job.attempts?.[0]);
  applyJob(
    state,
    { type: 'job.assign', id: job.id, expectedRevision: job.revision, units: 1, reason: '' },
    'retry-dispatcher',
  );
  expect(job.attempts).toHaveLength(2);
  expect(job.attempts?.[0]).toEqual(historical);
  expect(job.attempts?.[1]).toMatchObject({
    assignedBy: 'retry-dispatcher',
    outcome: 'active',
    units: 1,
  });
  state.missions[job.missionId!].status = 'completed';
  state.missions[job.missionId!].progress = 100;
  synchronizeJobs(state);
  expect(job.attempts?.[1].outcome).toBe('completed');
  expect(job.completedUnits).toBe(1);
});
it('a release that completes after pickup fails atomically without falsifying attempt history', async () => {
  const state = assigned(),
    clock = new ManualScheduler(),
    gateway = new FleetGateway(clock, state);
  const job = state.jobs['JOB-001'];
  const ticket = gateway.command(
    { id: 'manager', role: 'fleet-manager' },
    { type: 'job.release', id: job.id, expectedRevision: job.revision, reason: 'Requeue' },
  );
  const failure = expect(ticket.promise).rejects.toMatchObject({ code: 'stale' });
  gateway.advance(60);
  const beforeCompletion = gateway.getSnapshot();
  expect(beforeCompletion.jobs[job.id].custody).toBe('robot');
  clock.advance(250);
  await failure;
  expect(gateway.getSnapshot()).toBe(beforeCompletion);
  expect(gateway.getSnapshot().jobs[job.id].attempts?.[0].outcome).toBe('active');
});
it.each(['viewer', 'out-of-scope'] as const)(
  'rejects %s release without changing the assignment',
  async (access) => {
    const state = assigned(),
      clock = new ManualScheduler(),
      gateway = new FleetGateway(clock, state);
    const job = state.jobs['JOB-001'],
      before = gateway.getSnapshot();
    const ticket = gateway.command(
      {
        id: 'restricted',
        role: access === 'viewer' ? 'viewer' : 'fleet-manager',
        facilityIds: access === 'out-of-scope' ? [] : undefined,
      },
      { type: 'job.release', id: job.id, expectedRevision: job.revision, reason: 'Requeue' },
    );
    const failure = expect(ticket.promise).rejects.toMatchObject({ code: 'forbidden' });
    clock.advance(250);
    await failure;
    expect(gateway.getSnapshot()).toBe(before);
  },
);
it('release after pickup is forbidden even with a fresh revision', () => {
  const state = assigned(),
    job = state.jobs['JOB-001'];
  job.custody = 'robot';
  job.status = 'in-progress';
  const before = structuredClone(state);
  expect(() =>
    applyJob(state, {
      type: 'job.release',
      id: job.id,
      expectedRevision: job.revision,
      reason: 'Requeue',
    }),
  ).toThrow('Payload is in robot custody');
  expect(state).toEqual(before);
});
