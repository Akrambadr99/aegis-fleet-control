import { expect, it } from 'vitest';
import { createSeed } from './seed';
import { exportSnapshot, migrateSnapshot } from './snapshots';
it('migrates legacy snapshots without sharing mutable records and rejects unknown versions', () => {
  const original = createSeed();
  const exported = exportSnapshot(original);
  expect(migrateSnapshot(exported)).toEqual(exported);
  exported.state.robots['R-001'].battery = 0;
  expect(original.robots['R-001'].battery).not.toBe(0);
  expect(() => migrateSnapshot({ ...exported, schemaVersion: 99 })).toThrow('Unsupported');
});
