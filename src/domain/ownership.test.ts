import { expect, it } from 'vitest';
import { ownsLease, renewLease } from './ownership';
it('never renews expired or foreign ownership and returns an independent renewal', () => {
  const lease = { ownerId: 'a', acquiredAt: 0, expiresAt: 10, state: 'active' as const };
  expect(ownsLease(lease, 'a', 10)).toBe(false);
  expect(() => renewLease(lease, 'b', 5, 10)).toThrow('ownership lost');
  expect(() => renewLease(lease, 'a', 10, 10)).toThrow();
  expect(renewLease(lease, 'a', 5, 20).expiresAt).toBe(25);
  expect(lease.expiresAt).toBe(10);
});
