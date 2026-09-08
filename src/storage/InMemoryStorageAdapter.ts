import { DomainError } from '../domain/errors';
import { assertInvariants } from '../domain/invariants';
import type { DomainState } from '../domain/model';
import type { CanonicalStorage, EntityFor, EntityTableName } from './contracts';
import { shareUnchanged } from './structuralSharing';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

export class InMemoryStorageAdapter implements CanonicalStorage {
  private state: DomainState;
  private readonly listeners = new Set<() => void>();

  constructor(initial: DomainState) {
    const candidate = structuredClone(initial);
    assertInvariants(candidate);
    this.state = freeze(candidate);
  }

  readSnapshot = () => this.state;

  readEntity<Table extends EntityTableName>(table: Table, id: string) {
    const entities = this.state[table] as unknown as Record<string, EntityFor<Table>>;
    return entities[id] as Readonly<EntityFor<Table>> | undefined;
  }

  listEntities<Table extends EntityTableName>(table: Table) {
    const entities = this.state[table] as unknown as Record<string, EntityFor<Table>>;
    return Object.values(entities) as readonly Readonly<EntityFor<Table>>[];
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  commit(expectedRevision: number, candidate: DomainState) {
    if (this.state.revision !== expectedRevision)
      throw new DomainError('stale', 'Canonical state changed before the transaction committed');
    candidate.revision = expectedRevision + 1;
    assertInvariants(candidate);
    this.state = freeze(shareUnchanged(this.state, candidate));
    this.listeners.forEach((listener) => listener());
    return this.state;
  }
}
