import { expect, it } from 'vitest';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';
import { maintenanceReasons, capabilityIssues } from '../domain/maintenance';
import { missionFeasibility } from '../domain/selectors';
import type { Command } from '../domain/model';
function setup() {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock);
  async function run(command: Command) {
    const request = gateway.command({ id: 'manager', role: 'fleet-manager' }, command);
    clock.advance(250);
    return request.promise;
  }
  return { clock, gateway, run };
}
it('service entry pauses mission and releases charging and traffic ownership atomically', async () => {
  const { gateway, run } = setup();
  await run({ type: 'maintenance.start', id: 'SVC-R-001', expectedRevision: 1 });
  const s = gateway.getSnapshot();
  expect(s.robots['R-001'].status).toBe('maintenance');
  expect(s.missions['M-001'].pauseReason).toBe('Robot under maintenance');
  expect(s.routes['RT-001'].reservationState).toBe('released');
  expect(s.reservations['RES-001'].state).toBe('released');
  expect(s.robots['R-001'].chargerReservationId).toBeNull();
  expect(missionFeasibility(s, 'M-001').feasible).toBe(false);
  expect(s.activity.at(-1)?.changes?.some((c) => c.kind === 'maintenance')).toBe(true);
});
it('cannot skip verification or silently resume a mission on completion', async () => {
  const { gateway, run } = setup();
  await expect(
    run({ type: 'maintenance.complete', id: 'SVC-R-001', expectedRevision: 1 }),
  ).rejects.toMatchObject({ code: 'invalid' });
  await run({ type: 'maintenance.start', id: 'SVC-R-001', expectedRevision: 1 });
  await run({ type: 'maintenance.verify', id: 'SVC-R-001', expectedRevision: 2 });
  await run({ type: 'maintenance.complete', id: 'SVC-R-001', expectedRevision: 3 });
  expect(gateway.getSnapshot().robots['R-001'].status).toBe('paused');
  expect(gateway.getSnapshot().missions['M-001'].status).toBe('paused');
  expect(maintenanceReasons(gateway.getSnapshot(), gateway.getSnapshot().robots['R-001'])).toEqual(
    [],
  );
});
it('a maintenance robot remains stationary during deterministic telemetry updates', async () => {
  const { gateway, run } = setup();
  await run({ type: 'maintenance.start', id: 'SVC-R-001', expectedRevision: 1 });
  const position = gateway.getSnapshot().robots['R-001'].position;
  gateway.advance(5);
  expect(gateway.getSnapshot().robots['R-001'].position).toEqual(position);
});
it('service cannot clear an emergency stop', async () => {
  const { gateway, run } = setup();
  await run({ type: 'robot.stop', id: 'R-001', expectedRevision: 1 });
  await expect(
    run({ type: 'maintenance.start', id: 'SVC-R-001', expectedRevision: 1 }),
  ).rejects.toMatchObject({ code: 'invalid' });
  expect(gateway.getSnapshot().robots['R-001'].status).toBe('emergency-stopped');
});
it('capability requirements constrain mission eligibility', () => {
  const { gateway } = setup(),
    robot = gateway.getSnapshot().robots['R-001'];
  expect(capabilityIssues(robot, { payloadKg: 10000, actions: ['fly'] })).toEqual([
    'Payload exceeds robot capacity',
    'Unsupported action: fly',
  ]);
  expect(capabilityIssues(robot, { payloadKg: 10, actions: ['navigate'] })).toEqual([]);
});
it('facility scope applies to service work', async () => {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock);
  const request = gateway.command(
    { id: 'limited', role: 'fleet-manager', facilityIds: ['FAC-001'] },
    { type: 'maintenance.start', id: 'SVC-R-031', expectedRevision: 1 },
  );
  const result = expect(request.promise).rejects.toMatchObject({ code: 'forbidden' });
  clock.advance(250);
  await result;
});
it('a second concurrent service transition rejects a stale revision', async () => {
  const { gateway, clock } = setup();
  const command: Command = { type: 'maintenance.start', id: 'SVC-R-001', expectedRevision: 1 };
  const a = gateway.command({ id: 'a', role: 'administrator' }, command),
    b = gateway.command({ id: 'b', role: 'administrator' }, command);
  const failure = expect(b.promise).rejects.toMatchObject({ code: 'stale' });
  clock.advance(250);
  await a.promise;
  await failure;
});

it('reroute cannot reacquire released ownership during service or verification', async () => {
  const { gateway, run } = setup();
  await run({ type: 'maintenance.start', id: 'SVC-R-001', expectedRevision: 1 });
  for (const revision of [2, 3]) {
    if (revision === 3)
      await run({ type: 'maintenance.verify', id: 'SVC-R-001', expectedRevision: 2 });
    const before = gateway.getSnapshot();
    await expect(
      run({
        type: 'robot.reroute',
        id: 'R-001',
        expectedRevision: before.robots['R-001'].revision,
      }),
    ).rejects.toMatchObject({ code: 'invalid' });
    expect(gateway.getSnapshot()).toBe(before);
    expect(before.routes['RT-001'].reservationState).toBe('released');
  }
});
it('charger changes preserve released reservations while displacing queued peers', async () => {
  const { gateway, clock, run } = setup();
  await run({ type: 'maintenance.start', id: 'SVC-R-001', expectedRevision: 1 });
  const released = gateway.getSnapshot().reservations['RES-001'];
  for (const available of [false, true, false]) {
    const ticket = gateway.command(
      { id: 'facility', role: 'facility-manager' },
      {
        type: 'charger.set',
        id: 'CHG-001',
        expectedRevision: gateway.getSnapshot().chargers['CHG-001'].revision,
        available,
      },
    );
    clock.advance(250);
    await ticket.promise;
    expect(gateway.getSnapshot().reservations['RES-001']).toEqual(released);
    expect(gateway.getSnapshot().robots['R-001'].chargerReservationId).toBeNull();
  }
  expect(gateway.getSnapshot().reservations['RES-002'].state).toBe('displaced');
});
it('maintenance seed preserves the original active fleet and completed mission counts', () => {
  const { gateway } = setup();
  const state = gateway.getSnapshot();
  expect(Object.values(state.robots).filter((r) => r.status === 'running')).toHaveLength(96);
  expect(Object.values(state.missions).filter((m) => m.status === 'completed')).toHaveLength(120);
  expect(Object.values(state.robots).every((r) => r.activeMissionId)).toBe(true);
});
