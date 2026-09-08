import type { DomainState } from './model';
import { DomainError } from './errors';
import { assertInvariants } from './invariants';
import { defaultMotion } from './motion';

export const schemaVersion = 4;
export const fixtureVersion = 1;

export interface MigrationRecord {
  from: number;
  to: number;
}

export interface SnapshotEnvelope {
  schemaVersion: number;
  fixtureVersion: number;
  snapshotVersion: number;
  migrationHistory: MigrationRecord[];
  state: DomainState;
}

interface SnapshotInputEnvelope {
  schemaVersion: number;
  fixtureVersion: number;
  snapshotVersion?: number;
  migrationHistory?: MigrationRecord[];
  state: DomainState;
}

type Migration = (envelope: SnapshotInputEnvelope) => void;

const migrations: Readonly<Record<number, Migration>> = {
  1: (envelope) => {
    envelope.state.jobGroups ??= {};
  },
  2: (envelope) => {
    for (const robot of Object.values(envelope.state.robots)) robot.motion ??= { ...defaultMotion };
  },
  3: (envelope) => {
    envelope.snapshotVersion ??= envelope.state.revision;
    envelope.migrationHistory ??= [];
  },
};

export const migrationPath = Object.freeze(
  Object.keys(migrations).map((from) => ({ from: Number(from), to: Number(from) + 1 })),
);

function validateShape(envelope: SnapshotInputEnvelope) {
  if (
    !envelope.state ||
    typeof envelope.state !== 'object' ||
    !envelope.state.robots ||
    typeof envelope.state.robots !== 'object'
  )
    throw new DomainError('invalid', 'Malformed domain snapshot');
  if (!Number.isInteger(envelope.schemaVersion) || envelope.schemaVersion < 1)
    throw new DomainError('invalid', 'Malformed snapshot schema version');
  if (envelope.fixtureVersion !== fixtureVersion)
    throw new DomainError('invalid', 'Unsupported snapshot or fixture version');
}

/** Unwrapped state is the historical version-one format. Input is never mutated. */
export function migrateSnapshot(input: DomainState | SnapshotInputEnvelope): SnapshotEnvelope {
  const candidate = structuredClone(input);
  const envelope: SnapshotInputEnvelope =
    'schemaVersion' in candidate
      ? candidate
      : { schemaVersion: 1, fixtureVersion, state: candidate };
  validateShape(envelope);
  envelope.migrationHistory ??= [];
  while (envelope.schemaVersion < schemaVersion) {
    const migrate = migrations[envelope.schemaVersion];
    if (!migrate) throw new DomainError('invalid', 'Unsupported snapshot or fixture version');
    const from = envelope.schemaVersion;
    migrate(envelope);
    envelope.schemaVersion++;
    envelope.migrationHistory.push({ from, to: envelope.schemaVersion });
  }
  if (envelope.schemaVersion !== schemaVersion)
    throw new DomainError('invalid', 'Unsupported snapshot or fixture version');
  envelope.snapshotVersion ??= envelope.state.revision;
  if (!Number.isInteger(envelope.snapshotVersion) || envelope.snapshotVersion < 0)
    throw new DomainError('invalid', 'Malformed snapshot version');
  try {
    assertInvariants(envelope.state);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('invalid', 'Malformed domain snapshot');
  }
  return envelope as SnapshotEnvelope;
}

export function exportSnapshot(state: DomainState): SnapshotEnvelope {
  return migrateSnapshot({
    schemaVersion,
    fixtureVersion,
    snapshotVersion: state.revision,
    migrationHistory: [],
    state,
  });
}
