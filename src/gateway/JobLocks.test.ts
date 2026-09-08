import { expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { applyJobLock } from '../domain/jobLocks';
import { applyJob } from '../domain/jobs';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';
const owner = { id: 'dispatcher-a', role: 'fleet-manager' as const };
function locked() {
  const state = createSeed();
  applyJobLock(state, owner, {
    type: 'dispatch-lock.acquire',
    id: 'JOB-001',
    expectedRevision: 1,
    duration: 20,
    reason: 'Planning outbound assignment',
  });
  return state;
}
it('dispatch ownership guards job edits, release and cancellation even at the current revision', () => {
  const state = locked(),
    job = state.jobs['JOB-001'];
  expect(() =>
    applyJob(
      state,
      {
        type: 'job.save',
        id: job.id,
        expectedRevision: job.revision,
        input: { ...job, priority: 5 },
      },
      'dispatcher-b',
    ),
  ).toThrow('Dispatch owned by dispatcher-a');
  expect(() =>
    applyJob(
      state,
      { type: 'job.cancel', id: job.id, expectedRevision: job.revision, reason: 'Withdraw' },
      'dispatcher-b',
    ),
  ).toThrow('Dispatch owned by dispatcher-a');
  applyJob(
    state,
    {
      type: 'job.save',
      id: job.id,
      expectedRevision: job.revision,
      input: { ...job, priority: 5 },
    },
    owner.id,
  );
  expect(state.jobs[job.id].dispatchLock?.ownerId).toBe(owner.id);
});
it('renewal preserves owner and attribution; expiry records a single before/after event', async () => {
  const state = locked(),
    clock = new ManualScheduler(),
    gateway = new FleetGateway(clock, state);
  gateway.advance(10);
  const renew = gateway.command(owner, {
    type: 'dispatch-lock.renew',
    id: 'JOB-001',
    expectedRevision: 2,
    duration: 30,
  });
  clock.advance(250);
  await renew.promise;
  expect(gateway.getSnapshot().jobs['JOB-001'].dispatchLock).toMatchObject({
    ownerId: owner.id,
    acquiredAt: 0,
    expiresAt: 40,
    reason: 'Planning outbound assignment',
  });
  gateway.advance(30);
  gateway.advance(1);
  const events = gateway
    .getSnapshot()
    .activity.filter((event) => event.type === 'dispatch-lock.expired');
  expect(events).toHaveLength(1);
  expect(events[0].changes?.[0]).toMatchObject({
    kind: 'jobs',
    entityId: 'JOB-001',
    previous: { dispatchLock: { state: 'active' } },
    next: { dispatchLock: { state: 'released' } },
  });
  expect(gateway.getSnapshot().jobs['JOB-001'].dispatchLock?.state).toBe('released');
});
it('administrator takeover invalidates an earlier pending edit and retains the old owner in audit', async () => {
  const state = locked(),
    clock = new ManualScheduler(),
    gateway = new FleetGateway(clock, state);
  gateway.requests.plan({ delay: 300 }, { delay: 10 });
  const edit = gateway.command(owner, {
    type: 'job.save',
    id: 'JOB-001',
    expectedRevision: 2,
    input: { ...state.jobs['JOB-001'], title: 'Old dispatcher edit' },
  });
  const failure = expect(edit.promise).rejects.toMatchObject({ code: 'stale' });
  const takeover = gateway.command(
    { id: 'supervisor', role: 'administrator' },
    {
      type: 'dispatch-lock.takeover',
      id: 'JOB-001',
      expectedRevision: 2,
      duration: 60,
      reason: 'Shift takeover',
    },
  );
  clock.advance(350);
  await takeover.promise;
  await failure;
  expect(gateway.getSnapshot().jobs['JOB-001'].title).not.toBe('Old dispatcher edit');
  const event = gateway
    .getSnapshot()
    .activity.find((entry) => entry.type === 'dispatch-lock.takeover');
  expect(event?.changes?.[0]).toMatchObject({
    previous: { dispatchLock: { ownerId: owner.id } },
    next: { dispatchLock: { ownerId: 'supervisor' } },
  });
});
it('non-administrator takeover and foreign-owner release fail without mutating the job', () => {
  const state = locked(),
    before = structuredClone(state);
  expect(() =>
    applyJobLock(
      state,
      { id: 'other', role: 'fleet-manager' },
      {
        type: 'dispatch-lock.takeover',
        id: 'JOB-001',
        expectedRevision: 2,
        duration: 30,
        reason: 'Takeover',
      },
    ),
  ).toThrow('Only administrators');
  expect(() =>
    applyJobLock(
      state,
      { id: 'other', role: 'fleet-manager' },
      { type: 'dispatch-lock.release', id: 'JOB-001', expectedRevision: 2 },
    ),
  ).toThrow('Only the current dispatcher');
  expect(state).toEqual(before);
});
it('cancelling the job releases its dispatch ownership', () => {
  const state = locked();
  applyJob(
    state,
    { type: 'job.cancel', id: 'JOB-001', expectedRevision: 2, reason: 'Shipment withdrawn' },
    owner.id,
  );
  expect(state.jobs['JOB-001'].dispatchLock?.state).toBe('released');
});
