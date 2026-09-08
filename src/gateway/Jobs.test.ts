import { expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { rankCandidates, applyJob, synchronizeJobs } from '../domain/jobs';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';
function ready() {
  const state = createSeed();
  const r = state.robots['R-004'];
  r.status = 'idle';
  r.activeMissionId = null;
  r.battery = 95;
  r.position = { ...state.navigationNodes['F-001-OUT'].position };
  return state;
}
it('ranks real availability and rejects busy, maintenance and incapable robots', () => {
  const state = ready();
  const candidates = rankCandidates(state, state.jobs['JOB-001']);
  expect(candidates[0].robotId).toBe('R-004');
  expect(candidates[0].reasons).toEqual([]);
  state.maintenance['SVC-R-004'].status = 'in-progress';
  expect(
    rankCandidates(state, state.jobs['JOB-001']).find((c) => c.robotId === 'R-004')?.reasons,
  ).toContain('Robot under maintenance');
  expect(candidates.find((c) => c.robotId === 'R-001')?.reasons).toContain(
    'Payload capability mismatch',
  );
});
it('atomic assignment creates a linked mission, plan, route and workload', () => {
  const state = ready();
  applyJob(state, { type: 'job.assign', id: 'JOB-001', expectedRevision: 1, units: 2, reason: '' });
  const job = state.jobs['JOB-001'];
  expect(job.robotId).toBe('R-004');
  const mission = state.missions[job.missionId!];
  expect(mission.jobId).toBe(job.id);
  expect(state.plans[mission.planId!].steps.map((s) => s.kind)).toEqual([
    'navigate',
    'pickup',
    'navigate',
    'dropoff',
  ]);
  expect(state.routes[mission.routeId].reservationState).toBe('active');
});
it('partial deliveries preserve remaining quantity and unblock dependencies only at completion', () => {
  const state = ready();
  applyJob(state, { type: 'job.assign', id: 'JOB-001', expectedRevision: 1, units: 2, reason: '' });
  const job = state.jobs['JOB-001'];
  const mission = state.missions[job.missionId!];
  mission.status = 'completed';
  mission.progress = 100;
  state.robots[mission.robotId].status = 'idle';
  synchronizeJobs(state);
  expect(job.status).toBe('partially-completed');
  expect(job.completedUnits).toBe(2);
  expect(rankCandidates(state, state.jobs['JOB-002'])[0].reasons).toContain(
    'Predecessor job incomplete',
  );
});
it('custody prevents cancellation or reassignment after pickup', () => {
  const state = ready();
  applyJob(state, { type: 'job.assign', id: 'JOB-001', expectedRevision: 1, units: 1, reason: '' });
  const job = state.jobs['JOB-001'];
  state.missions[job.missionId!].progress = job.pickupProgress + 1;
  synchronizeJobs(state);
  expect(() =>
    applyJob(state, {
      type: 'job.cancel',
      id: job.id,
      expectedRevision: job.revision,
      reason: 'Change request',
    }),
  ).toThrow('Payload is in robot custody');
});
it('manual overrides require current robot revision and reasoning', () => {
  const state = ready();
  expect(() =>
    applyJob(state, {
      type: 'job.assign',
      id: 'JOB-001',
      expectedRevision: 1,
      robotId: 'R-004',
      expectedRobotRevision: 0,
      units: 1,
      reason: 'Nearby',
    }),
  ).toThrow('Robot state changed');
  expect(() =>
    applyJob(state, {
      type: 'job.assign',
      id: 'JOB-001',
      expectedRevision: 1,
      robotId: 'R-004',
      expectedRobotRevision: 1,
      units: 1,
      reason: '',
    }),
  ).toThrow('Manual assignment reasoning');
});
it('pre-pickup cancellation releases route and robot without reporting delivery', () => {
  const state = ready();
  applyJob(state, { type: 'job.assign', id: 'JOB-001', expectedRevision: 1, units: 1, reason: '' });
  const job = state.jobs['JOB-001'],
    mission = state.missions[job.missionId!];
  applyJob(state, {
    type: 'job.cancel',
    id: job.id,
    expectedRevision: job.revision,
    reason: 'Order withdrawn',
  });
  expect(job.completedUnits).toBe(0);
  expect(state.routes[mission.routeId].reservationState).toBe('released');
  expect(state.robots[mission.robotId].activeMissionId).toBeNull();
});
it('only one concurrent assignment can acquire a robot and all failures roll back', async () => {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock, ready());
  const actor = { id: 'manager', role: 'fleet-manager' as const };
  const a = gateway.command(actor, {
      type: 'job.assign',
      id: 'JOB-001',
      expectedRevision: 1,
      units: 1,
      reason: '',
    }),
    b = gateway.command(actor, {
      type: 'job.assign',
      id: 'JOB-001',
      expectedRevision: 1,
      units: 1,
      reason: '',
    });
  const failure = expect(b.promise).rejects.toMatchObject({ code: 'stale' });
  clock.advance(250);
  await a.promise;
  await failure;
  expect(
    Object.values(gateway.getSnapshot().missions).filter((m) => m.jobId === 'JOB-001'),
  ).toHaveLength(1);
});
it('job creation rejects invalid station ownership and dependency cycles', () => {
  const state = ready(),
    input = { ...state.jobs['JOB-001'], dependsOn: ['JOB-002'] };
  expect(() =>
    applyJob(state, { type: 'job.save', id: 'JOB-001', expectedRevision: 1, input }),
  ).toThrow('cycle');
  expect(() =>
    applyJob(state, {
      type: 'job.save',
      id: 'NEW',
      expectedRevision: 0,
      input: { ...input, dependsOn: [], destinationZoneId: 'Z-031' },
    }),
  ).toThrow('stations');
});
