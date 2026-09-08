import { expect, it } from 'vitest';
import { ManualScheduler } from './scheduler';
it('allows deterministic stepping, pending inspection and cancellation', () => {
  const clock = new ManualScheduler();
  const calls: number[] = [];
  clock.schedule(10, () => calls.push(1));
  const cancel = clock.schedule(10, () => calls.push(2));
  cancel();
  clock.schedule(20, () => calls.push(3));
  expect(clock.inspectPending()).toHaveLength(2);
  clock.runNext();
  expect(calls).toEqual([1]);
  expect(clock.time).toBe(10);
  clock.runNext();
  expect(calls).toEqual([1, 3]);
  expect(() => clock.advance(Infinity)).toThrow();
  expect(() => clock.schedule(NaN, () => {})).toThrow();
});
