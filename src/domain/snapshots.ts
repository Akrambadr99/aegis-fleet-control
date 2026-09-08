import type { DomainState } from './model';
import { DomainError } from './errors';
import { assertInvariants } from './invariants';
export const schemaVersion = 1;
export const fixtureVersion = 1;
export interface SnapshotEnvelope {
  schemaVersion: number;
  fixtureVersion: number;
  state: DomainState;
}
/** Version zero is the historical unwrapped in-memory state. Input is never mutated. */
export function migrateSnapshot(input: DomainState | SnapshotEnvelope): SnapshotEnvelope {
  const candidate = structuredClone(input);
  const envelope: SnapshotEnvelope =
    'schemaVersion' in candidate ? candidate : { schemaVersion, fixtureVersion, state: candidate };
  if (envelope.schemaVersion !== schemaVersion || envelope.fixtureVersion !== fixtureVersion)
    throw new DomainError('invalid', 'Unsupported snapshot or fixture version');
  try {
    assertInvariants(envelope.state);
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('invalid', 'Malformed domain snapshot');
  }
  return envelope;
}
export function exportSnapshot(state: DomainState): SnapshotEnvelope {
  return migrateSnapshot(state);
}
