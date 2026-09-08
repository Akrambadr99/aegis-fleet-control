import { expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { dispatchJobs, type JobAssignment } from '../application/jobDispatch';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';
const actor = { id: 'dispatcher', role: 'fleet-manager' as const };
function setup() {
  const state = createSeed(),
    robot = state.robots['R-004'];
  robot.status = 'idle';
  robot.activeMissionId = null;
  robot.battery = 95;
  robot.position = { ...state.navigationNodes['F-001-OUT'].position };
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock, state);
  const commands: JobAssignment[] = ['JOB-001', 'JOB-002'].map((id) => ({
    type: 'job.assign',
    id,
    expectedRevision: 1,
    units: 1,
    reason: '',
  }));
  return { clock, gateway, commands };
}
it.each([
  [50, 300],
  [300, 50],
])('keeps independent outcomes when completion delays are %i / %i', async (first, second) => {
  const { clock, gateway, commands } = setup();
  gateway.requests.plan({ delay: first }, { delay: second });
  const pending = dispatchJobs(
    actor,
    commands,
    (identity, command) => gateway.command(identity, command).promise,
  );
  commands[0].id = 'changed-after-submission';
  clock.advance(350);
  const report = await pending;
  expect(report).toMatchObject({ confirmed: 1, failed: 1 });
  expect(report.outcomes.map((outcome) => outcome.jobId)).toEqual(['JOB-001', 'JOB-002']);
  expect(report.outcomes[1]).toMatchObject({ status: 'failed', code: 'invalid' });
  expect(gateway.getSnapshot().jobs['JOB-001'].status).toBe('assigned');
  expect(gateway.getSnapshot().jobs['JOB-002'].status).toBe('queued');
});
it('cancellation preserves confirmed assignments and prevents unfinished commands from publishing', async () => {
  const { clock, gateway, commands } = setup(),
    controller = new AbortController();
  gateway.requests.plan({ delay: 10 }, { delay: 300 });
  const pending = dispatchJobs(
    actor,
    commands,
    (identity, command) => gateway.command(identity, command, controller.signal).promise,
  );
  clock.advance(10);
  controller.abort();
  clock.advance(500);
  const report = await pending;
  expect(report.confirmed).toBe(1);
  expect(report.outcomes[1]).toMatchObject({ status: 'failed', code: 'cancelled' });
  expect(gateway.getSnapshot().jobs['JOB-001'].missionIds).toHaveLength(1);
  expect(gateway.getSnapshot().jobs['JOB-002'].missionId).toBeNull();
});
it('retrying a selected job cannot silently replace an existing successful assignment', async () => {
  const { clock, gateway, commands } = setup();
  const first = dispatchJobs(
    actor,
    [commands[0]],
    (identity, command) => gateway.command(identity, command).promise,
  );
  clock.advance(250);
  await first;
  const before = gateway.getSnapshot();
  const retry = dispatchJobs(
    actor,
    [{ ...commands[0], expectedRevision: before.jobs['JOB-001'].revision }],
    (identity, command) => gateway.command(identity, command).promise,
  );
  clock.advance(250);
  expect((await retry).outcomes[0]).toMatchObject({
    status: 'failed',
    message: expect.stringContaining('already has an assignment'),
  });
  expect(gateway.getSnapshot()).toBe(before);
});
it('invalid duplicate batches do not submit any commands', async () => {
  const { gateway, commands } = setup();
  let submitted = 0;
  await expect(
    dispatchJobs(actor, [commands[0], commands[0]], (identity, command) => {
      submitted++;
      return gateway.command(identity, command).promise;
    }),
  ).rejects.toThrow('distinct jobs');
  expect(submitted).toBe(0);
});
