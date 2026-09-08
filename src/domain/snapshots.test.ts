import { expect, it } from 'vitest';
import { createSeed } from './seed';
import {
  exportSnapshot,
  fixtureVersion,
  migrateSnapshot,
  migrationPath,
  schemaVersion,
} from './snapshots';

it('exports a current snapshot with explicit independent version metadata', () => {
  const original = createSeed();
  const exported = exportSnapshot(original);

  expect(exported).toMatchObject({
    schemaVersion,
    fixtureVersion,
    snapshotVersion: original.revision,
    migrationHistory: [],
  });
  exported.state.robots['R-001'].battery = 0;
  expect(original.robots['R-001'].battery).not.toBe(0);
});

it('migrates every historical schema in order without mutating its input', () => {
  const versionOne = createSeed();
  delete (versionOne as Partial<typeof versionOne>).jobGroups;
  for (const robot of Object.values(versionOne.robots)) delete robot.motion;
  const before = structuredClone(versionOne);

  const migrated = migrateSnapshot(versionOne);

  expect(versionOne).toEqual(before);
  expect(migrated.schemaVersion).toBe(schemaVersion);
  expect(migrated.snapshotVersion).toBe(versionOne.revision);
  expect(migrated.migrationHistory).toEqual(migrationPath);
  expect(migrated.state.jobGroups).toEqual({});
  expect(migrated.state.robots['R-001'].motion).toBeDefined();
});

it('continues a prior migration history and is idempotent at the current schema', () => {
  const state = createSeed();
  const versionThree = {
    schemaVersion: 3,
    fixtureVersion,
    state,
    migrationHistory: [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
    ],
  };

  const migrated = migrateSnapshot(versionThree);

  expect(migrated.migrationHistory).toEqual(migrationPath);
  expect(migrateSnapshot(migrated)).toEqual(migrated);
});

it('rejects unknown schemas, fixtures and malformed snapshot versions', () => {
  const exported = exportSnapshot(createSeed());
  expect(() => migrateSnapshot({ ...exported, schemaVersion: 99 })).toThrow('Unsupported');
  expect(() => migrateSnapshot({ ...exported, fixtureVersion: 99 })).toThrow('Unsupported');
  expect(() => migrateSnapshot({ ...exported, snapshotVersion: -1 })).toThrow('snapshot version');
});
