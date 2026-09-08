import type { DomainState, Versioned } from '../domain/model';

export type EntityTableName = {
  [Key in keyof DomainState]: DomainState[Key] extends Record<string, Versioned> ? Key : never;
}[keyof DomainState];

export type EntityFor<Table extends EntityTableName> =
  DomainState[Table] extends Record<string, infer Entity> ? Entity : never;

export interface CanonicalRepository {
  readSnapshot(): DomainState;
  readEntity<Table extends EntityTableName>(
    table: Table,
    id: string,
  ): Readonly<EntityFor<Table>> | undefined;
  listEntities<Table extends EntityTableName>(table: Table): readonly Readonly<EntityFor<Table>>[];
}

export interface CanonicalStorage extends CanonicalRepository {
  /** Consumes a fully validated transaction candidate and publishes it exactly once. */
  commit(expectedRevision: number, candidate: DomainState): DomainState;
  subscribe(listener: () => void): () => void;
}
