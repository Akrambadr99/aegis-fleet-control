import { expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { missionFeasibility } from '../domain/selectors';
import { rankCandidates } from '../domain/jobs';
import { robotHistory } from '../domain/history';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';

it('execution and telemetry agree with the remaining route estimate', () => {
  const state = createSeed();
  state.robots['R-004'].battery = 95;
  const gateway = new FleetGateway(new ManualScheduler(), state);
  const estimate = missionFeasibility(state, 'M-004');
  expect(estimate.etaSeconds).toBe(80);
  expect(estimate.distance).toBe(96);
  gateway.advance(79);
  expect(gateway.getSnapshot().missions['M-004'].status).toBe('running');
  gateway.advance();
  const current = gateway.getSnapshot();
  expect(current.missions['M-004'].status).toBe('completed');
  expect(current.robots['R-004'].battery).toBeCloseTo(95 - estimate.batteryRequired, 4);
  expect(current.routes['RT-004'].reservationState).toBe('released');
  expect(
    current.telemetry.filter((sample) => sample.robotId === 'R-004').at(-1)?.velocity,
  ).toBeCloseTo(1.2);
  expect(robotHistory(current, 'R-004').at(-1)?.battery).toBe(current.robots['R-004'].battery);
});
it('scheduler pickup and loaded delivery estimates match the generated mission motion', async () => {
  const state = createSeed(),
    robot = state.robots['R-004'];
  robot.status = 'idle';
  robot.activeMissionId = null;
  robot.battery = 95;
  robot.position = { ...state.navigationNodes['F-001-OUT'].position };
  const candidate = rankCandidates(state, state.jobs['JOB-001']).find(
    (entry) => entry.robotId === robot.id,
  )!;
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock, state);
  const assign = gateway.command(
    { id: 'dispatcher', role: 'fleet-manager' },
    { type: 'job.assign', id: 'JOB-001', expectedRevision: 1, units: 1, reason: '' },
  );
  clock.advance(250);
  await assign.promise;
  const missionId = gateway.getSnapshot().jobs['JOB-001'].missionId!;
  for (let remaining = candidate.duration; remaining > 0; remaining -= 100)
    gateway.advance(Math.min(100, remaining));
  expect(gateway.getSnapshot().missions[missionId].status).toBe('completed');
  expect(gateway.getSnapshot().robots[robot.id].battery).toBeCloseTo(
    95 - candidate.batteryRequired,
    4,
  );
  expect(gateway.getSnapshot().jobs['JOB-001'].completedUnits).toBe(1);
});

it('keeps the original low-battery robot paused when the detour would consume its reserve', async () => {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock, createSeed());
  async function complete(command: Parameters<FleetGateway['command']>[1]) {
    const request = gateway.command({ id: 'planner', role: 'administrator' }, command);
    clock.advance(250);
    return request.promise;
  }
  await complete({ type: 'corridor.set', id: 'C-001', expectedRevision: 1, open: false });
  await complete({
    type: 'robot.reroute',
    id: 'R-001',
    expectedRevision: gateway.getSnapshot().robots['R-001'].revision,
  });
  const state = gateway.getSnapshot();
  expect(state.robots['R-001'].battery).toBe(32);
  const estimate = missionFeasibility(state, 'M-001');
  expect(estimate.distance).toBe(130);
  expect(estimate.batteryRequired).toBeCloseTo(15.6);
  expect(estimate.reasons).toContain('Insufficient mission reserve');
  await expect(
    complete({
      type: 'robot.resume',
      id: 'R-001',
      expectedRevision: state.robots['R-001'].revision,
    }),
  ).rejects.toThrow();
  expect(gateway.getSnapshot().missions['M-001'].status).toBe('paused');
  expect(gateway.getSnapshot().robots['R-001'].battery).toBe(32);
});
