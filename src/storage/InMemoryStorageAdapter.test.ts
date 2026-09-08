import { describe, expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { InMemoryStorageAdapter } from './InMemoryStorageAdapter';

describe('InMemoryStorageAdapter', () => {
  it('owns a detached, immutable canonical snapshot and normalized entity reads', () => {
    const seed = createSeed();
    const storage = new InMemoryStorageAdapter(seed);
    seed.robots['R-001'].battery = 0;

    expect(storage.readEntity('robots', 'R-001')?.battery).not.toBe(0);
    expect(storage.listEntities('facilities')).toHaveLength(4);
    expect(Object.isFrozen(storage.readSnapshot())).toBe(true);
    expect(Object.isFrozen(storage.readEntity('robots', 'R-001'))).toBe(true);
  });

  it('publishes one atomic revision while retaining unchanged entity identities', () => {
    const storage = new InMemoryStorageAdapter(createSeed());
    const before = storage.readSnapshot();
    const candidate = structuredClone(before);
    candidate.robots['R-001'].battery--;
    candidate.robots['R-001'].revision++;
    let notifications = 0;
    storage.subscribe(() => notifications++);

    const published = storage.commit(before.revision, candidate);

    expect(published.revision).toBe(before.revision + 1);
    expect(published.robots['R-001']).not.toBe(before.robots['R-001']);
    expect(published.robots['R-002']).toBe(before.robots['R-002']);
    expect(published.facilities).toBe(before.facilities);
    expect(notifications).toBe(1);
  });

  it('rejects stale and invalid candidates without publishing or notifying', () => {
    const storage = new InMemoryStorageAdapter(createSeed());
    const before = storage.readSnapshot();
    let notifications = 0;
    storage.subscribe(() => notifications++);

    expect(() => storage.commit(before.revision - 1, structuredClone(before))).toThrow(
      'Canonical state changed',
    );
    const invalid = structuredClone(before);
    invalid.robots['R-001'].battery = 101;
    let failure: unknown;
    try {
      storage.commit(before.revision, invalid);
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      code: 'invariant',
      message: expect.stringContaining('Robot battery must be a bounded percentage'),
    });
    expect(storage.readSnapshot()).toBe(before);
    expect(notifications).toBe(0);
  });
});
