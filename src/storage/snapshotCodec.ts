import { DomainError } from '../domain/errors';
import type { SnapshotEnvelope } from '../domain/snapshots';

export const persistedSnapshotFormatVersion = 1;
const checksumAlgorithm = 'fnv1a32';

interface PersistedSnapshotRecord {
  formatVersion: typeof persistedSnapshotFormatVersion;
  checksumAlgorithm: typeof checksumAlgorithm;
  checksum: string;
  snapshot: SnapshotEnvelope;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A deterministic corruption checksum. This is deliberately not an authenticity signature. */
function checksum(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function encodePersistedSnapshot(snapshot: SnapshotEnvelope) {
  const payload = JSON.stringify(snapshot);
  const record: PersistedSnapshotRecord = {
    formatVersion: persistedSnapshotFormatVersion,
    checksumAlgorithm,
    checksum: checksum(payload),
    snapshot,
  };
  return JSON.stringify(record);
}

/** Returns either a verified record payload or a legacy unwrapped snapshot. */
export function decodePersistedSnapshot(raw: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DomainError('invalid', 'Stored fleet snapshot is not valid JSON');
  }

  if (!isRecord(parsed) || !Object.hasOwn(parsed, 'formatVersion')) return parsed;
  if (
    parsed.formatVersion !== persistedSnapshotFormatVersion ||
    parsed.checksumAlgorithm !== checksumAlgorithm ||
    typeof parsed.checksum !== 'string' ||
    !isRecord(parsed.snapshot)
  )
    throw new DomainError('invalid', 'Unsupported persisted snapshot format');

  const payload = JSON.stringify(parsed.snapshot);
  if (checksum(payload) !== parsed.checksum)
    throw new DomainError('invalid', 'Persisted snapshot checksum mismatch');
  return parsed.snapshot;
}
