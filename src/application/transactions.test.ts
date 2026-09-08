import { expect, it } from 'vitest';
import { FleetGateway } from '../gateway/FleetGateway';
import { ManualScheduler } from '../gateway/scheduler';
import { createSeed } from '../domain/seed';
import { executeTransaction } from './transactions';
const actor = { id: 'operator', role: 'administrator' as const };
it('traces atomic commands and retains failures without publishing a failed draft', async () => {
  const clock = new ManualScheduler();
  const gateway = new FleetGateway(clock);
  const before = gateway.getSnapshot();
  const command = {
    type: 'robot.stop' as const,
    id: 'R-001',
    expectedRevision: before.robots['R-001'].revision,
  };
  const first = gateway.command(actor, command);
  const second = gateway.command(actor, command);
  expect(gateway.requests.getOperations().filter((o) => o.status === 'pending')).toHaveLength(2);
  const failed = expect(second.promise).rejects.toMatchObject({ code: 'stale' });
  clock.advance(250);
  await first.promise;
  await failed;
  expect(gateway.getSnapshot().revision).toBe(before.revision + 1);
  const event = gateway.getSnapshot().activity.at(-1)!;
  expect(event.correlationId).toBe(event.operationId);
  expect(gateway.requests.getOperations().map((o) => o.status)).toEqual(['confirmed', 'stale']);
  expect(before.robots['R-001'].status).toBe('running');
});
it('cancelled work leaves no domain events and leaves a diagnostic outcome', async () => {
  const clock = new ManualScheduler();
  const gateway = new FleetGateway(clock);
  const before = gateway.getSnapshot();
  const ticket = gateway.command(actor, { type: 'robot.stop', id: 'R-001', expectedRevision: 1 });
  const rejected = expect(ticket.promise).rejects.toMatchObject({ code: 'cancelled' });
  ticket.cancel();
  await rejected;
  clock.advance(500);
  expect(gateway.getSnapshot()).toBe(before);
  expect(gateway.requests.getOperations()[0].status).toBe('cancelled');
});

it('returns the bounded event range owned by a transaction without mutating its source', () => {
  const source = createSeed();
  const start = source.activity.length;

  const transaction = executeTransaction(
    source,
    actor,
    { type: 'robot.stop', id: 'R-001', expectedRevision: 1 },
    { operationId: 'OP-test', correlationId: 'COR-test' },
  );

  expect(transaction.state).not.toBe(source);
  expect(source.robots['R-001'].status).toBe('running');
  expect(transaction.eventRange).toEqual({
    start,
    length: transaction.state.activity.length - start,
  });
  expect(
    transaction.state.activity
      .slice(start, start + transaction.eventRange.length)
      .every((event) => event.operationId === 'OP-test' && event.correlationId === 'COR-test'),
  ).toBe(true);
});
