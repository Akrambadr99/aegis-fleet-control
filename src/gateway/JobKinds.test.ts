import { expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { applyJob, rankCandidates, synchronizeJobs } from '../domain/jobs';
import { jobKinds, jobProfiles } from '../domain/jobKinds';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';

function ready() {
  const state = createSeed();
  const robot = state.robots['R-004'];
  robot.status = 'idle';
  robot.activeMissionId = null;
  robot.battery = 95;
  robot.position = { ...state.navigationNodes['F-001-OUT'].position };
  robot.capabilities.actions = ['navigate', 'lift', 'inspect'];
  return state;
}
it.each(jobKinds)('%s generates an attributed plan and matching execution requirements', (kind) => {
  const state = ready(),
    job = state.jobs['JOB-001'];
  job.kind = kind;
  job.payloadKg = jobProfiles[kind].cargo ? 60 : 0;
  applyJob(
    state,
    { type: 'job.assign', id: job.id, expectedRevision: 1, units: 1, reason: '' },
    'dispatcher',
  );
  const mission = state.missions[job.missionId!],
    plan = state.plans[mission.planId!];
  expect(mission.requirements?.actions).toEqual(jobProfiles[kind].actions);
  expect(plan.ownerId).toBe('dispatcher');
  expect(plan.steps.some((step) => step.kind === 'pickup')).toBe(jobProfiles[kind].cargo);
  expect(plan.steps.some((step) => step.kind === 'inspect')).toBe(kind === 'inspection');
  expect(plan.steps.find((step) => step.id === 'destination')?.label).toBe(
    jobProfiles[kind].destination,
  );
});
it('rejects inspection dispatch when current robot capabilities no longer satisfy the job', async () => {
  const clock = new ManualScheduler(),
    state = ready();
  state.jobs['JOB-001'].kind = 'inspection';
  state.jobs['JOB-001'].payloadKg = 0;
  state.robots['R-004'].capabilities.actions = ['navigate'];
  const gateway = new FleetGateway(clock, state);
  expect(
    rankCandidates(state, state.jobs['JOB-001']).find((item) => item.robotId === 'R-004')?.reasons,
  ).toContain('Required capability: inspect');
  const before = gateway.getSnapshot();
  const ticket = gateway.command(
    { id: 'dispatcher', role: 'fleet-manager' },
    {
      type: 'job.assign',
      id: 'JOB-001',
      expectedRevision: 1,
      units: 1,
      robotId: 'R-004',
      expectedRobotRevision: state.robots['R-004'].revision,
      reason: 'Inspection specialist',
    },
  );
  const failure = expect(ticket.promise).rejects.toThrow('Required capability: inspect');
  clock.advance(250);
  await failure;
  expect(gateway.getSnapshot()).toBe(before);
});
it('non-cargo work never acquires payload custody and records service lifecycle events', () => {
  const state = ready(),
    job = state.jobs['JOB-001'];
  job.kind = 'inspection';
  job.payloadKg = 0;
  applyJob(state, { type: 'job.assign', id: job.id, expectedRevision: 1, units: 1, reason: '' });
  const mission = state.missions[job.missionId!];
  mission.progress = 99;
  expect(synchronizeJobs(state)[0].event).toBe('job.started');
  expect(job.custody).toBe('source');
  expect(synchronizeJobs(state)).toEqual([]);
  mission.status = 'completed';
  mission.progress = 100;
  expect(synchronizeJobs(state)[0].event).toBe('job.completed');
  expect(job.completedUnits).toBe(1);
});
it('preserves the meaning of delivered units while allowing priority and deadline edits', () => {
  const state = ready(),
    job = state.jobs['JOB-001'];
  job.completedUnits = 1;
  job.status = 'partially-completed';
  expect(() =>
    applyJob(state, {
      type: 'job.save',
      id: job.id,
      expectedRevision: 1,
      input: { ...job, destinationZoneId: job.sourceZoneId, sourceZoneId: job.destinationZoneId },
    }),
  ).toThrow('Delivered work fixes');
  applyJob(state, {
    type: 'job.save',
    id: job.id,
    expectedRevision: 1,
    input: { ...job, priority: 5 },
  });
  expect(state.jobs[job.id]).toMatchObject({ priority: 5, completedUnits: 1, kind: 'transport' });
});
it('additional inspection requirements reach both scheduler rejection and generated plan', () => {
  const state = ready(),
    job = state.jobs['JOB-001'];
  job.requiredActions = ['inspect'];
  applyJob(state, { type: 'job.assign', id: job.id, expectedRevision: 1, units: 1, reason: '' });
  const mission = state.missions[job.missionId!];
  expect(mission.requirements?.actions).toContain('inspect');
  expect(state.plans[mission.planId!].steps.at(-1)?.kind).toBe('inspect');
});
