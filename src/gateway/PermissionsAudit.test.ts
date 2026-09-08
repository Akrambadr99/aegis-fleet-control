import { describe, it, expect } from 'vitest';
import type { Actor, Command, Robot } from '../domain/model';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';
const actor: Actor = { id: 'operator-a', role: 'administrator', facilityIds: ['FAC-001'] };
function setup() {
  const clock = new ManualScheduler();
  return { clock, gateway: new FleetGateway(clock) };
}
const outside: Command[] = [
  { type: 'corridor.set', id: 'C-010', expectedRevision: 1, open: false },
  { type: 'charger.set', id: 'CHG-010', expectedRevision: 1, available: false },
  { type: 'fault.acknowledge', id: 'FLT-039', expectedRevision: 1 },
  { type: 'robot.stop', id: 'R-031', expectedRevision: 1 },
  { type: 'robot.pause', id: 'R-031', expectedRevision: 1 },
  { type: 'robot.resume', id: 'R-039', expectedRevision: 1 },
  { type: 'robot.reroute', id: 'R-031', expectedRevision: 1 },
];
describe('facility command authorization', () => {
  it.each(outside)(
    'rejects $type outside the granted facility without changing any records',
    async (command) => {
      const { clock, gateway } = setup(),
        before = gateway.getSnapshot();
      const request = gateway.command(actor, command);
      const failure = expect(request.promise).rejects.toMatchObject({ code: 'forbidden' });
      clock.advance(250);
      await failure;
      expect(gateway.getSnapshot()).toBe(before);
    },
  );
  it('preserves role constraints inside an allowed facility', async () => {
    const { clock, gateway } = setup();
    const request = gateway.command(
      { ...actor, role: 'operator' },
      { type: 'corridor.set', id: 'C-001', expectedRevision: 1, open: false },
    );
    const failure = expect(request.promise).rejects.toMatchObject({ code: 'forbidden' });
    clock.advance(250);
    await failure;
  });
  it('executes an allowed robot command inside the granted facility', async () => {
    const { clock, gateway } = setup();
    const request = gateway.command(
      { ...actor, role: 'operator' },
      { type: 'robot.pause', id: 'R-001', expectedRevision: 1 },
    );
    clock.advance(250);
    await request.promise;
    expect(gateway.getSnapshot().robots['R-001'].status).toBe('paused');
  });
  it('returns partial authorization results for a mixed-facility bulk request', async () => {
    const { clock, gateway } = setup();
    const result = gateway.bulk(actor, [
      { type: 'robot.pause', id: 'R-001', expectedRevision: 1 },
      { type: 'robot.pause', id: 'R-031', expectedRevision: 1 },
    ]);
    clock.advance(250);
    expect((await result).map((outcome) => outcome.status)).toEqual(['confirmed', 'failed']);
    expect(gateway.getSnapshot().robots['R-031'].status).toBe('running');
  });
  it('copies the actor grant before an asynchronous request can observe caller mutations', async () => {
    const { clock, gateway } = setup(),
      identity: Actor = { id: 'local', role: 'operator', facilityIds: ['FAC-001'] };
    const request = gateway.command(identity, {
      type: 'robot.pause',
      id: 'R-031',
      expectedRevision: 1,
    });
    const failure = expect(request.promise).rejects.toMatchObject({ code: 'forbidden' });
    identity.facilityIds!.push('FAC-002');
    clock.advance(250);
    await failure;
  });
  it('an explicitly empty grant cannot control any facility', async () => {
    const { clock, gateway } = setup();
    const request = gateway.command(
      { ...actor, facilityIds: [] },
      { type: 'robot.stop', id: 'R-001', expectedRevision: 1 },
    );
    const failure = expect(request.promise).rejects.toMatchObject({ code: 'forbidden' });
    clock.advance(250);
    await failure;
  });
});
describe('structured atomic audit', () => {
  it('captures all changed records in a corridor closure with actor and deterministic timestamp', async () => {
    const { clock, gateway } = setup();
    const request = gateway.command(actor, {
      type: 'corridor.set',
      id: 'C-001',
      expectedRevision: 1,
      open: false,
    });
    clock.advance(250);
    await request.promise;
    const event = gateway.getSnapshot().activity.at(-1)!;
    expect(event.actorId).toBe('operator-a');
    expect(event.actorRole).toBe('administrator');
    expect(event.timestamp).toBe('2026-01-01T00:00:00.000Z');
    expect(event.changes!.find((c) => c.entityId === 'C-001')?.previous).toMatchObject({
      open: true,
      revision: 1,
    });
    expect(event.changes!.find((c) => c.entityId === 'C-001')?.next).toMatchObject({
      open: false,
      revision: 2,
    });
    expect(new Set(event.changes!.map((c) => c.kind))).toEqual(
      new Set(['facilities', 'corridors', 'robots', 'missions', 'routes']),
    );
    expect(event.changes!.find((c) => c.entityId === 'M-001')?.next).toMatchObject({
      status: 'paused',
    });
  });
  it('earlier before/after history stays unchanged after subsequent commands', async () => {
    const { clock, gateway } = setup();
    const pause = gateway.command(actor, { type: 'robot.pause', id: 'R-001', expectedRevision: 1 });
    clock.advance(250);
    await pause.promise;
    const event = gateway.getSnapshot().activity.at(-1)!;
    const stop = gateway.command(actor, { type: 'robot.stop', id: 'R-001', expectedRevision: 2 });
    clock.advance(250);
    await stop.promise;
    expect((event.changes!.find((c) => c.entityId === 'R-001')!.next as Robot).status).toBe(
      'paused',
    );
    expect(Object.isFrozen(event.changes![0].next)).toBe(true);
    expect(gateway.getSnapshot().robots['R-001'].status).toBe('emergency-stopped');
  });
  it('an injected command failure creates no successful audit record', async () => {
    const { clock, gateway } = setup(),
      count = gateway.getSnapshot().activity.length;
    gateway.requests.plan({ failure: 'Rejected by resource' });
    const request = gateway.command(actor, {
      type: 'robot.pause',
      id: 'R-001',
      expectedRevision: 1,
    });
    const failure = expect(request.promise).rejects.toThrow('Rejected by resource');
    clock.advance(250);
    await failure;
    expect(gateway.getSnapshot().activity).toHaveLength(count);
  });
});
