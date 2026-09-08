import type { AuditChange, DomainState, Versioned } from './model';
const tables = [
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
] as const;
export type EntityCapture = Map<string, Versioned>;
export function captureEntities(state: DomainState): EntityCapture {
  const capture: EntityCapture = new Map();
  for (const kind of tables)
    for (const entity of Object.values(state[kind]))
      capture.set(`${kind}:${entity.id}`, structuredClone(entity));
  return capture;
}
export function changedEntities(before: EntityCapture, state: DomainState): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const kind of tables)
    for (const entity of Object.values(state[kind])) {
      const previous = before.get(`${kind}:${entity.id}`) ?? null;
      if (!previous || previous.revision !== entity.revision)
        changes.push({ kind, entityId: entity.id, previous, next: structuredClone(entity) });
    }
  return changes;
}
