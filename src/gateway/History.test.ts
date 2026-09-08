import { expect, it } from 'vitest';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';
import { robotHistory, historyAtTick } from '../domain/history';
it('reconstructs earlier motion independently of the current robot snapshot', () => {
  const gateway = new FleetGateway(new ManualScheduler());
  const initial = gateway.getSnapshot().robots['R-004'].position;
  gateway.advance(5);
  const frames = robotHistory(gateway.getSnapshot(), 'R-004');
  expect(historyAtTick(frames, 0)?.position).toEqual(initial);
  expect(historyAtTick(frames, 5)?.position).toEqual(
    gateway.getSnapshot().robots['R-004'].position,
  );
  expect(historyAtTick(frames, 0)?.position).not.toEqual(historyAtTick(frames, 5)?.position);
});
it('records command-time faults and ownership without rewriting older samples', async () => {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock);
  const ticket = gateway.command(
    { id: 'admin', role: 'administrator' },
    { type: 'robot.connection', id: 'R-004', expectedRevision: 1, connected: false },
  );
  clock.advance(250);
  await ticket.promise;
  const frames = robotHistory(gateway.getSnapshot(), 'R-004');
  expect(frames[0].faults).toEqual([]);
  expect(frames.at(-1)?.faults[0].message).toBe('Control link disconnected');
  expect(frames.at(-1)?.eventId).toBe(gateway.getSnapshot().activity.at(-1)?.id);
});
it('seeking before the recorded window returns no fabricated state', () => {
  const gateway = new FleetGateway(new ManualScheduler());
  expect(historyAtTick(robotHistory(gateway.getSnapshot(), 'R-004'), -1)).toBeUndefined();
});
it('replay sampling leaves the live state immutable and unchanged', () => {
  const gateway = new FleetGateway(new ManualScheduler());
  gateway.advance(3);
  const before = gateway.getSnapshot();
  const frame = historyAtTick(robotHistory(before, 'R-004'), 1);
  expect(frame?.tick).toBe(1);
  expect(gateway.getSnapshot()).toBe(before);
  expect(Object.isFrozen(frame?.position)).toBe(true);
});
