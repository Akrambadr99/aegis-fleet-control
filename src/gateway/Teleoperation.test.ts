import type { Actor } from '../domain/model';
import { expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { applyControl, synchronizeControls } from '../domain/teleoperation';
import { applyCommand } from '../domain/transactions';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';
const owner = { id: 'operator-a', role: 'operator' as const };
function acquired() {
  const state = createSeed();
  applyControl(state, owner, {
    type: 'control.acquire',
    id: 'R-004',
    expectedRevision: 1,
    duration: 30,
  });
  return state;
}
it('exclusive control acquisition pauses execution and releases route ownership', () => {
  const state = acquired();
  expect(state.robots['R-004'].status).toBe('manual');
  expect(state.missions['M-004'].status).toBe('paused');
  expect(state.routes['RT-004'].reservationState).toBe('released');
  expect(() =>
    applyControl(
      state,
      { id: 'b', role: 'operator' },
      {
        type: 'control.acquire',
        id: 'R-004',
        expectedRevision: state.robots['R-004'].revision,
        duration: 30,
      },
    ),
  ).toThrow('already owned');
});
it('only the owner can move and acknowledged motion updates telemetry', () => {
  const state = acquired(),
    robot = state.robots['R-004'],
    before = { ...robot.position };
  expect(() =>
    applyControl(
      state,
      { id: 'b', role: 'operator' },
      { type: 'control.move', id: robot.id, expectedRevision: robot.revision, dx: 1, dy: 0 },
    ),
  ).toThrow('another operator');
  applyControl(state, owner, {
    type: 'control.move',
    id: robot.id,
    expectedRevision: robot.revision,
    dx: 1,
    dy: 0,
  });
  expect(robot.position.x).toBeGreaterThan(before.x);
  expect(state.telemetry.at(-1)?.x).toBe(robot.position.x);
});
it('release and expiry never silently resume autonomous execution', () => {
  const state = acquired(),
    robot = state.robots['R-004'];
  state.tick = 30;
  synchronizeControls(state);
  expect(robot.status).toBe('paused');
  expect(robot.controlSessionId).toBeNull();
  expect(state.missions['M-004'].pauseReason).toBe('Control lease expired');
});
it('connection loss revokes control and creates a fault; reconnect does not resume', () => {
  const state = acquired(),
    robot = state.robots['R-004'];
  applyControl(
    state,
    { id: 'admin', role: 'administrator' },
    { type: 'robot.connection', id: robot.id, expectedRevision: robot.revision, connected: false },
  );
  expect(robot.controlSessionId).toBeNull();
  expect(robot.status).toBe('paused');
  expect(state.faults['COMMS-R-004'].status).toBe('active');
  applyControl(
    state,
    { id: 'admin', role: 'administrator' },
    { type: 'robot.connection', id: robot.id, expectedRevision: robot.revision, connected: true },
  );
  expect(robot.status).toBe('paused');
  expect(state.faults['COMMS-R-004'].status).toBe('resolved');
});
it('emergency stop revokes manual control and rejects further motion', () => {
  const state = acquired(),
    robot = state.robots['R-004'];
  applyCommand(state, owner, {
    type: 'robot.stop',
    id: robot.id,
    expectedRevision: robot.revision,
  });
  expect(robot.status).toBe('emergency-stopped');
  expect(() =>
    applyControl(state, owner, {
      type: 'control.move',
      id: robot.id,
      expectedRevision: robot.revision,
      dx: 1,
      dy: 0,
    }),
  ).toThrow('No active control');
});
it('gateway rejects unauthorized control and records successful command receipts', async () => {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock);
  const denied = gateway.command(
    { id: 'viewer', role: 'viewer' },
    { type: 'control.acquire', id: 'R-004', expectedRevision: 1, duration: 30 },
  );
  const rejected = expect(denied.promise).rejects.toMatchObject({ code: 'forbidden' });
  clock.advance(250);
  await rejected;
  const accepted = gateway.command(owner, {
    type: 'control.acquire',
    id: 'R-004',
    expectedRevision: 1,
    duration: 30,
  });
  clock.advance(250);
  await accepted.promise;
  expect(gateway.getSnapshot().activity.at(-1)?.type).toBe('control.acquire');
  expect(gateway.getSnapshot().replay.at(-1)?.status).toBe('manual');
});
it('invalid direction and maintenance eligibility are domain constraints', () => {
  const state = acquired(),
    robot = state.robots['R-004'];
  expect(() =>
    applyControl(state, owner, {
      type: 'control.move',
      id: robot.id,
      expectedRevision: robot.revision,
      dx: Infinity,
      dy: 0,
    }),
  ).toThrow('bounded');
  const other = state.robots['R-006'];
  state.maintenance['SVC-R-006'].status = 'verification';
  expect(() =>
    applyControl(state, owner, {
      type: 'control.acquire',
      id: other.id,
      expectedRevision: other.revision,
      duration: 30,
    }),
  ).toThrow('maintenance');
});

it('renews control and atomically transfers ownership on administrator takeover', async () => {
  const clock = new ManualScheduler();
  const gateway = new FleetGateway(clock);
  const perform = async (
    actor: Actor,
    type: 'control.acquire' | 'control.renew' | 'control.takeover',
  ) => {
    const ticket = gateway.command(actor, {
      type,
      id: 'R-001',
      expectedRevision: gateway.getSnapshot().robots['R-001'].revision,
      duration: 30,
    });
    clock.advance(250);
    await ticket.promise;
  };
  await perform({ id: 'first', role: 'administrator' }, 'control.acquire');
  const id = gateway.getSnapshot().robots['R-001'].controlSessionId!;
  gateway.advance(1);
  await perform({ id: 'first', role: 'administrator' }, 'control.renew');
  expect(gateway.getSnapshot().leases[id].expiresAt).toBe(31);
  await perform({ id: 'second', role: 'administrator' }, 'control.takeover');
  expect(gateway.getSnapshot().leases[id].state).toBe('released');
  const current = gateway.getSnapshot();
  expect(current.leases[current.robots['R-001'].controlSessionId!].ownerId).toBe('second');
});
