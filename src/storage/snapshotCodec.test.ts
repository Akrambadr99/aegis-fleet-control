import { expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { exportSnapshot } from '../domain/snapshots';
import {
  decodePersistedSnapshot,
  encodePersistedSnapshot,
  persistedSnapshotFormatVersion,
} from './snapshotCodec';

it('round trips a versioned persisted record with its checksum', () => {
  const snapshot = exportSnapshot(createSeed());
  const encoded = encodePersistedSnapshot(snapshot);
  const record = JSON.parse(encoded);

  expect(record).toMatchObject({
    formatVersion: persistedSnapshotFormatVersion,
    checksumAlgorithm: 'fnv1a32',
    checksum: expect.stringMatching(/^[0-9a-f]{8}$/),
  });
  expect(encoded).toContain('"snapshot":{"schemaVersion"');
  expect(encoded).not.toContain('"snapshot":"{');
  expect(decodePersistedSnapshot(encoded)).toEqual(snapshot);
});

it('rejects changed payloads and unknown persisted formats', () => {
  const record = JSON.parse(encodePersistedSnapshot(exportSnapshot(createSeed())));
  record.snapshot.state.robots['R-001'].battery--;
  expect(() => decodePersistedSnapshot(JSON.stringify(record))).toThrow('checksum mismatch');

  record.formatVersion++;
  expect(() => decodePersistedSnapshot(JSON.stringify(record))).toThrow('Unsupported');
});

it('passes legacy snapshots through for schema migration', () => {
  const snapshot = exportSnapshot(createSeed());
  expect(decodePersistedSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
});
