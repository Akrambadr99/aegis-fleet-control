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

const stateRecordKeys = [
  'automationRules',
  'facilities',
  'floors',
  'zones',
  'corridors',
  'navigationNodes',
  'navigationEdges',
  'robots',
  'missions',
  'routes',
  'chargers',
  'reservations',
  'faults',
  'leases',
  'resources',
  'resourceReservations',
  'jobs',
  'jobGroups',
  'plans',
  'planRevisions',
  'missionTemplates',
  'maintenance',
] as const satisfies readonly (keyof DomainState)[];

const stateArrayKeys = [
  'automationRuns',
  'history',
  'activity',
  'replay',
  'telemetry',
] as const satisfies readonly (keyof DomainState)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

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

function validateMigrationHistory(history: unknown, envelopeVersion: number) {
  if (!Array.isArray(history)) throw new DomainError('invalid', 'Malformed migration history');
  let previousTo: number | undefined;
  for (const step of history) {
    if (
      !isRecord(step) ||
      !Number.isInteger(step.from) ||
      !Number.isInteger(step.to) ||
      (step.from as number) < 1 ||
      step.to !== (step.from as number) + 1 ||
      (previousTo !== undefined && step.from !== previousTo) ||
      (step.to as number) > envelopeVersion
    )
      throw new DomainError('invalid', 'Malformed migration history');
    previousTo = step.to as number;
  }
  if (previousTo !== undefined && previousTo !== envelopeVersion)
    throw new DomainError('invalid', 'Migration history does not match snapshot schema');
}

function validateEnvelope(envelope: SnapshotInputEnvelope) {
  if (!isRecord(envelope.state) || !isRecord(envelope.state.robots))
    throw new DomainError('invalid', 'Malformed domain snapshot');
  if (!Number.isInteger(envelope.schemaVersion) || envelope.schemaVersion < 1)
    throw new DomainError('invalid', 'Malformed snapshot schema version');
  if (envelope.fixtureVersion !== fixtureVersion)
    throw new DomainError('invalid', 'Unsupported snapshot or fixture version');
  if (envelope.migrationHistory !== undefined)
    validateMigrationHistory(envelope.migrationHistory, envelope.schemaVersion);
}

function validateCanonicalShape(state: DomainState) {
  if (
    !Number.isInteger(state.revision) ||
    state.revision < 0 ||
    !Number.isInteger(state.tick) ||
    state.tick < 0 ||
    !Number.isInteger(state.historySequence) ||
    state.historySequence < 0 ||
    stateRecordKeys.some((key) => !isRecord(state[key])) ||
    stateArrayKeys.some((key) => !Array.isArray(state[key]))
  )
    throw new DomainError('invalid', 'Malformed canonical state shape');
}

function cloneInput(input: unknown): Record<string, unknown> {
  try {
    const candidate: unknown = structuredClone(input);
    if (!isRecord(candidate)) throw new DomainError('invalid', 'Malformed domain snapshot');
    return candidate;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('invalid', 'Malformed domain snapshot');
  }
}

/** Unwrapped state is the historical version-one format. Input is never mutated. */
export function migrateSnapshot(input: unknown): SnapshotEnvelope {
  const candidate = cloneInput(input);
  const envelope: SnapshotInputEnvelope =
    'schemaVersion' in candidate
      ? (candidate as unknown as SnapshotInputEnvelope)
      : { schemaVersion: 1, fixtureVersion, state: candidate as unknown as DomainState };
  validateEnvelope(envelope);
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
  validateMigrationHistory(envelope.migrationHistory, envelope.schemaVersion);
  validateCanonicalShape(envelope.state);
  if (envelope.snapshotVersion !== envelope.state.revision)
    throw new DomainError('invalid', 'Snapshot version does not match canonical revision');
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
