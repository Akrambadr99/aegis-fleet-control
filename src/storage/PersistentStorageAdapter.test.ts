import { describe, expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { exportSnapshot } from '../domain/snapshots';
import { PersistentStorageAdapter, type KeyValueStorage } from './PersistentStorageAdapter';

class FakeStorage implements KeyValueStorage {
  value: string | null = null;
  failWrites = false;

  getItem() {
    return this.value;
  }

  setItem(_key: string, value: string) {
    if (this.failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    this.value = value;
  }
}

describe('PersistentStorageAdapter', () => {
  it('restores a committed canonical snapshot in a new adapter instance', () => {
    const persistence = new FakeStorage();
    const first = new PersistentStorageAdapter(persistence, createSeed());
    const before = first.readSnapshot();
    const candidate = structuredClone(before);
    candidate.robots['R-001'].battery--;
    candidate.robots['R-001'].revision++;

    first.commit(before.revision, candidate);
    expect(JSON.parse(persistence.value!).formatVersion).toBe(1);
    const restored = new PersistentStorageAdapter(persistence, createSeed());

    expect(restored.readSnapshot().revision).toBe(before.revision + 1);
    expect(restored.readSnapshot().robots['R-001'].battery).toBe(
      before.robots['R-001'].battery - 1,
    );
    expect(Object.isFrozen(restored.readSnapshot())).toBe(true);
  });

  it('migrates historical persisted snapshots before making them canonical', () => {
    const persistence = new FakeStorage();
    const historical = createSeed();
    delete (historical as Partial<typeof historical>).jobGroups;
    for (const robot of Object.values(historical.robots)) delete robot.motion;
    persistence.value = JSON.stringify(historical);

    const restored = new PersistentStorageAdapter(persistence, createSeed()).readSnapshot();

    expect(restored.jobGroups).toEqual({});
    expect(restored.robots['R-001'].motion).toBeDefined();
  });

  it('leaves canonical state and subscribers untouched when persistence fails', () => {
    const persistence = new FakeStorage();
    const adapter = new PersistentStorageAdapter(persistence, createSeed());
    const before = adapter.readSnapshot();
    const candidate = structuredClone(before);
    candidate.robots['R-001'].battery--;
    let notifications = 0;
    adapter.subscribe(() => notifications++);
    persistence.failWrites = true;

    expect(() => adapter.commit(before.revision, candidate)).toThrow('Quota exceeded');
    expect(adapter.readSnapshot()).toBe(before);
    expect(notifications).toBe(0);
  });

  it('rejects a stale application instance without overwriting the newer persisted revision', () => {
    const persistence = new FakeStorage();
    const first = new PersistentStorageAdapter(persistence, createSeed());
    const second = new PersistentStorageAdapter(persistence, createSeed());
    const firstBefore = first.readSnapshot();
    const firstCandidate = structuredClone(firstBefore);
    firstCandidate.robots['R-001'].battery--;
    first.commit(firstBefore.revision, firstCandidate);
    const persistedByFirst = persistence.value;

    const secondBefore = second.readSnapshot();
    const secondCandidate = structuredClone(secondBefore);
    secondCandidate.robots['R-002'].battery--;
    expect(() => second.commit(secondBefore.revision, secondCandidate)).toThrow(
      'changed in another application instance',
    );

    expect(persistence.value).toBe(persistedByFirst);
    expect(second.readSnapshot()).toBe(secondBefore);
    expect(new PersistentStorageAdapter(persistence, createSeed()).readSnapshot()).toEqual(
      first.readSnapshot(),
    );
  });

  it('rejects corrupt and invalid persisted data instead of silently resetting it', () => {
    const persistence = new FakeStorage();
    persistence.value = '{broken';
    expect(() => new PersistentStorageAdapter(persistence, createSeed())).toThrow('not valid JSON');

    const invalid = exportSnapshot(createSeed());
    invalid.state.robots['R-001'].battery = 101;
    persistence.value = JSON.stringify(invalid);
    expect(() => new PersistentStorageAdapter(persistence, createSeed())).toThrow(
      'Robot battery must be a bounded percentage',
    );
  });

  it('rejects a persisted snapshot whose checked payload was altered', () => {
    const persistence = new FakeStorage();
    const adapter = new PersistentStorageAdapter(persistence, createSeed());
    const before = adapter.readSnapshot();
    adapter.commit(before.revision, structuredClone(before));
    const record = JSON.parse(persistence.value!);
    record.snapshot.state.tick++;
    persistence.value = JSON.stringify(record);

    expect(() => new PersistentStorageAdapter(persistence, createSeed())).toThrow(
      'checksum mismatch',
    );
  });
});
