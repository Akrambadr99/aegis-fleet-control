import { describe, it, expect } from 'vitest';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';
import { createSeed } from '../domain/seed';
import { missionFeasibility, simulationInputs, trafficConflicts } from '../domain/selectors';
import type { Actor, Command } from '../domain/model';
const admin: Actor = { id: 'test', role: 'administrator' };
function fixture() {
  const clock = new ManualScheduler();
  return { clock, gateway: new FleetGateway(clock) };
}
describe('cross-domain transactions', () => {
  it('closes a corridor atomically across topology, routes, missions, audit and simulation', async () => {
    const { clock, gateway } = fixture();
    let notifications = 0;
    gateway.subscribe(() => notifications++);
    const ticket = gateway.command(admin, {
      type: 'corridor.set',
      id: 'C-001',
      expectedRevision: 1,
      open: false,
    });
    clock.advance(250);
    await ticket.promise;
    const s = gateway.getSnapshot();
    expect(s.corridors['C-001'].open).toBe(false);
    expect(s.facilities['FAC-001'].topologyRevision).toBe(2);
    expect(s.routes['RT-001'].state).toBe('invalid');
    expect(s.missions['M-001'].status).toBe('paused');
    expect(trafficConflicts(s, 'FAC-001').length).toBeGreaterThan(0);
    expect(simulationInputs(s, 'FAC-001').closedCorridors).toContain('C-001');
    expect(missionFeasibility(s, 'M-001').feasible).toBe(false);
    expect(s.activity.at(-1)?.type).toBe('corridor.set');
    expect(notifications).toBe(1);
  });
  it('displaces charging reservations and propagates readiness warnings', async () => {
    const { clock, gateway } = fixture();
    const ticket = gateway.command(admin, {
      type: 'charger.set',
      id: 'CHG-001',
      expectedRevision: 1,
      available: false,
    });
    clock.advance(250);
    await ticket.promise;
    const s = gateway.getSnapshot();
    expect(s.reservations['RES-001'].state).toBe('displaced');
    expect(missionFeasibility(s, 'M-001').reasons).toContain('Charging reservation displaced');
    expect(simulationInputs(s, 'FAC-001').availableChargers).toBe(8);
  });
  it('emergency stop revokes control, pauses execution, releases traffic and records a replay frame', async () => {
    const clock = new ManualScheduler(),
      seed = createSeed();
    seed.robots['R-001'].controlSessionId = 'lease';
    seed.leases.lease = {
      id: 'lease',
      revision: 1,
      robotId: 'R-001',
      ownerId: 'other',
      expiresAt: 10,
      state: 'active',
    };
    const gateway = new FleetGateway(clock, seed);
    const ticket = gateway.command(admin, { type: 'robot.stop', id: 'R-001', expectedRevision: 1 });
    clock.advance(250);
    await ticket.promise;
    const s = gateway.getSnapshot();
    expect(s.robots['R-001'].status).toBe('emergency-stopped');
    expect(s.robots['R-001'].controlSessionId).toBeNull();
    expect(s.leases.lease.state).toBe('released');
    expect(s.missions['M-001'].pauseReason).toBe('Emergency stop');
    expect(s.routes['RT-001'].reservationState).toBe('released');
    expect(s.replay.at(-1)?.status).toBe('emergency-stopped');
  });
  it('rejects unauthorized commands without audit or partial writes', async () => {
    const { clock, gateway } = fixture();
    const before = gateway.getSnapshot();
    const ticket = gateway.command(
      { id: 'viewer', role: 'viewer' },
      { type: 'robot.stop', id: 'R-001', expectedRevision: 1 },
    );
    const result = expect(ticket.promise).rejects.toMatchObject({ code: 'forbidden' });
    clock.advance(250);
    await result;
    expect(gateway.getSnapshot()).toBe(before);
  });
  it('same-resource concurrent commands cannot overwrite a newer revision', async () => {
    const { clock, gateway } = fixture();
    gateway.requests.plan({ delay: 50 }, { delay: 10 });
    const first = gateway.command(admin, { type: 'robot.pause', id: 'R-001', expectedRevision: 1 }),
      second = gateway.command(admin, { type: 'robot.stop', id: 'R-001', expectedRevision: 1 });
    const rejected = expect(first.promise).rejects.toMatchObject({ code: 'stale' });
    clock.advance(50);
    await second.promise;
    await rejected;
    expect(first.status).toBe('stale');
    expect(gateway.getSnapshot().robots['R-001'].status).toBe('emergency-stopped');
  });
  it('independent out-of-order mutations both survive', async () => {
    const { clock, gateway } = fixture();
    gateway.requests.plan({ delay: 50 }, { delay: 10 });
    const a = gateway.command(admin, { type: 'robot.pause', id: 'R-001', expectedRevision: 1 }),
      b = gateway.command(admin, {
        type: 'charger.set',
        id: 'CHG-002',
        expectedRevision: 1,
        available: false,
      });
    clock.advance(50);
    await Promise.all([a.promise, b.promise]);
    expect(gateway.getSnapshot().robots['R-001'].status).toBe('paused');
    expect(gateway.getSnapshot().chargers['CHG-002'].available).toBe(false);
  });
  it('cancelled mutation never changes confirmed state', async () => {
    const { clock, gateway } = fixture();
    const ticket = gateway.command(admin, { type: 'robot.stop', id: 'R-001', expectedRevision: 1 });
    const rejected = expect(ticket.promise).rejects.toMatchObject({ code: 'cancelled' });
    ticket.cancel();
    clock.advance(1000);
    await rejected;
    expect(clock.pending).toBe(0);
    expect(gateway.getSnapshot().revision).toBe(1);
  });
  it('failure injection preserves all domain state', async () => {
    const { clock, gateway } = fixture();
    const before = gateway.getSnapshot();
    gateway.requests.plan({ failure: 'Lost acknowledgement' });
    const ticket = gateway.command(admin, {
      type: 'corridor.set',
      id: 'C-001',
      expectedRevision: 1,
      open: false,
    });
    const rejected = expect(ticket.promise).rejects.toThrow('Lost acknowledgement');
    clock.advance(250);
    await rejected;
    expect(gateway.getSnapshot()).toBe(before);
  });
  it('bulk commands return per-resource partial outcomes', async () => {
    const { clock, gateway } = fixture();
    const commands: Command[] = ['R-001', 'R-010', 'R-009'].map((id) => ({
      type: 'robot.pause',
      id,
      expectedRevision: 1,
    }));
    const result = gateway.bulk(admin, commands);
    clock.advance(250);
    const outcomes = await result;
    expect(outcomes.map((r) => r.status)).toEqual(['confirmed', 'failed', 'failed']);
    expect(gateway.getSnapshot().robots['R-001'].status).toBe('paused');
  });
  it('reopening a corridor does not silently resume impacted robots', async () => {
    const { clock, gateway } = fixture();
    const a = gateway.command(admin, {
      type: 'corridor.set',
      id: 'C-001',
      expectedRevision: 1,
      open: false,
    });
    clock.advance(250);
    await a.promise;
    const b = gateway.command(admin, {
      type: 'corridor.set',
      id: 'C-001',
      expectedRevision: 2,
      open: true,
    });
    clock.advance(250);
    await b.promise;
    expect(gateway.getSnapshot().missions['M-001'].status).toBe('paused');
    expect(gateway.getSnapshot().routes['RT-001'].state).toBe('invalid');
  });
  it('fault acknowledgement retains the safety block and records the operator', async () => {
    const { clock, gateway } = fixture();
    const a = gateway.command(admin, {
      type: 'fault.acknowledge',
      id: 'FLT-009',
      expectedRevision: 1,
    });
    clock.advance(250);
    await a.promise;
    expect(gateway.getSnapshot().faults['FLT-009'].acknowledgedBy).toBe('test');
    expect(missionFeasibility(gateway.getSnapshot(), 'M-009').reasons).toContain('Active fault');
  });
  it('deterministic ticks produce identical telemetry and preserve stopped robot positions', async () => {
    const a = fixture(),
      b = fixture();
    a.gateway.advance(4);
    b.gateway.advance(4);
    expect(a.gateway.getSnapshot()).toEqual(b.gateway.getSnapshot());
    const robot = a.gateway.getSnapshot().robots['R-001'];
    const stop = a.gateway.command(admin, {
      type: 'robot.stop',
      id: robot.id,
      expectedRevision: robot.revision,
    });
    a.clock.advance(250);
    await stop.promise;
    const position = a.gateway.getSnapshot().robots[robot.id].position;
    a.gateway.advance(5);
    expect(a.gateway.getSnapshot().robots[robot.id].position).toEqual(position);
  });
  it('retains immutable snapshots and clean instance isolation', () => {
    const a = fixture(),
      b = fixture();
    const before = a.gateway.getSnapshot();
    a.gateway.advance();
    expect(before.tick).toBe(0);
    expect(b.gateway.getSnapshot().tick).toBe(0);
    expect(Object.isFrozen(before.robots['R-001'].position)).toBe(true);
  });
});
describe('asynchronous reads', () => {
  it('rejects a route preview calculated against an older topology', async () => {
    const { clock, gateway } = fixture();
    gateway.requests.plan({ delay: 100 }, { delay: 10 });
    const preview = gateway.previewRoute('R-001');
    const rejected = expect(preview.promise).rejects.toMatchObject({ code: 'stale' });
    const write = gateway.command(admin, {
      type: 'corridor.set',
      id: 'C-001',
      expectedRevision: 1,
      open: false,
    });
    clock.advance(100);
    await write.promise;
    await rejected;
  });
  it('rejects a route preview after robot telemetry changes', async () => {
    const { clock, gateway } = fixture();
    const preview = gateway.previewRoute('R-001');
    const rejected = expect(preview.promise).rejects.toMatchObject({ code: 'stale' });
    gateway.advance();
    clock.advance(250);
    await rejected;
  });
  it('supports cancelling an already-aborted read without leaking timers', async () => {
    const { clock, gateway } = fixture();
    const controller = new AbortController();
    controller.abort();
    const ticket = gateway.readRobot('R-001', controller.signal);
    await expect(ticket.promise).rejects.toMatchObject({ code: 'cancelled' });
    expect(clock.pending).toBe(0);
  });
  it('returns explicit request-time snapshots even if later responses finish first', async () => {
    const { clock, gateway } = fixture();
    gateway.requests.plan({ delay: 100 }, { delay: 10 });
    const a = gateway.readRobot('R-001'),
      b = gateway.readRobot('R-002');
    clock.advance(10);
    expect(b.status).toBe('confirmed');
    expect(a.status).toBe('pending');
    clock.advance(90);
    expect((await a.promise).id).toBe('R-001');
    expect((await b.promise).id).toBe('R-002');
  });
});

it('explicit rerouting updates reservation, mission cost and preview before safe resume', async () => {
  const { clock, gateway } = fixture();
  const close = gateway.command(admin, {
    type: 'corridor.set',
    id: 'C-001',
    expectedRevision: 1,
    open: false,
  });
  clock.advance(250);
  await close.promise;
  const robot = gateway.getSnapshot().robots['R-001'];
  const reroute = gateway.command(admin, {
    type: 'robot.reroute',
    id: robot.id,
    expectedRevision: robot.revision,
  });
  clock.advance(250);
  await reroute.promise;
  const s = gateway.getSnapshot();
  expect(s.routes['RT-001'].corridorIds).toEqual(['C-002']);
  expect(s.routes['RT-001'].state).toBe('valid');
  expect(s.missions['M-001'].status).toBe('paused');
  expect(missionFeasibility(s, 'M-001').distance).toBe(130);
  const preview = gateway.previewRoute(robot.id);
  clock.advance(250);
  expect((await preview.promise).corridorIds).toEqual(['C-002']);
  const resume = gateway.command(admin, {
    type: 'robot.resume',
    id: robot.id,
    expectedRevision: s.robots[robot.id].revision,
  });
  clock.advance(250);
  await resume.promise;
  expect(gateway.getSnapshot().missions['M-001'].status).toBe('running');
  expect(gateway.getSnapshot().routes['RT-001'].reservationState).toBe('active');
});
it('reroute failure leaves existing route and audit intact when all lanes are closed', async () => {
  const { clock, gateway } = fixture();
  for (const id of ['C-001', 'C-002', 'C-003']) {
    const request = gateway.command(admin, {
      type: 'corridor.set',
      id,
      expectedRevision: 1,
      open: false,
    });
    clock.advance(250);
    await request.promise;
  }
  const before = gateway.getSnapshot(),
    robot = before.robots['R-001'];
  const request = gateway.command(admin, {
    type: 'robot.reroute',
    id: robot.id,
    expectedRevision: robot.revision,
  });
  const failure = expect(request.promise).rejects.toMatchObject({ code: 'invalid' });
  clock.advance(250);
  await failure;
  expect(gateway.getSnapshot()).toBe(before);
});
it('explicit supersession has a distinct outcome and prevents the old operation from running', async () => {
  const { clock, gateway } = fixture();
  const old = gateway.readRobot('R-001');
  const rejected = expect(old.promise).rejects.toMatchObject({ code: 'superseded' });
  old.supersede();
  const current = gateway.readRobot('R-002');
  clock.advance(250);
  await rejected;
  expect(old.status).toBe('superseded');
  expect((await current.promise).id).toBe('R-002');
  expect(clock.pending).toBe(0);
});
it('settled operations cannot be cancelled or superseded retroactively', async () => {
  const { clock, gateway } = fixture();
  const ticket = gateway.readRobot('R-001');
  clock.advance(250);
  await ticket.promise;
  ticket.cancel();
  ticket.supersede();
  expect(ticket.status).toBe('confirmed');
});
