import { DomainError } from '../domain/errors';
import type { DomainState } from '../domain/model';
import { exportSnapshot, migrateSnapshot } from '../domain/snapshots';
import type { CanonicalStorage, EntityFor, EntityTableName } from './contracts';
import { InMemoryStorageAdapter } from './InMemoryStorageAdapter';
import { decodePersistedSnapshot, encodePersistedSnapshot } from './snapshotCodec';

export const fleetSnapshotStorageKey = 'aegis.fleet.snapshot';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function restore(raw: string): DomainState {
  try {
    return migrateSnapshot(decodePersistedSnapshot(raw)).state;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError('invalid', 'Stored fleet snapshot is malformed');
  }
}

/**
 * Synchronous durable storage for the browser demonstration. A write reaches the
 * backing store before the in-memory snapshot is published, so a quota or access
 * failure cannot expose a state that will disappear after reload.
 */
export class PersistentStorageAdapter implements CanonicalStorage {
  private readonly memory: InMemoryStorageAdapter;
  private persistedSource: string | null;

  constructor(
    private readonly persistence: KeyValueStorage,
    fallback: DomainState,
    private readonly key = fleetSnapshotStorageKey,
  ) {
    const raw = persistence.getItem(key);
    this.persistedSource = raw;
    this.memory = new InMemoryStorageAdapter(raw === null ? fallback : restore(raw));
  }

  readSnapshot = () => this.memory.readSnapshot();

  readEntity<Table extends EntityTableName>(table: Table, id: string) {
    return this.memory.readEntity(table, id) as Readonly<EntityFor<Table>> | undefined;
  }

  listEntities<Table extends EntityTableName>(table: Table) {
    return this.memory.listEntities(table) as readonly Readonly<EntityFor<Table>>[];
  }

  subscribe = (listener: () => void) => this.memory.subscribe(listener);

  commit(expectedRevision: number, candidate: DomainState) {
    const current = this.memory.readSnapshot();
    if (current.revision !== expectedRevision)
      throw new DomainError('stale', 'Canonical state changed before the transaction committed');
    if (this.persistence.getItem(this.key) !== this.persistedSource)
      throw new DomainError(
        'stale',
        'Persisted fleet state changed in another application instance',
      );

    const next = structuredClone(candidate);
    next.revision = expectedRevision + 1;
    const serialized = encodePersistedSnapshot(exportSnapshot(next));
    this.persistence.setItem(this.key, serialized);
    this.persistedSource = serialized;
    return this.memory.commit(expectedRevision, next);
  }
}
