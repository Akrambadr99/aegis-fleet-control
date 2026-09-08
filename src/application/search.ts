import type { Actor, DomainState } from '../domain/model';
export type SearchKind =
  | 'robot'
  | 'mission'
  | 'job'
  | 'facility'
  | 'fault'
  | 'charger'
  | 'resource'
  | 'maintenance';
export interface SearchEntry {
  kind: SearchKind;
  id: string;
  label: string;
  facilityId: string;
  href: string;
}
export function buildSearchIndex(state: DomainState): SearchEntry[] {
  const entries: SearchEntry[] = [];
  const add = (
    kind: SearchKind,
    id: string,
    label: string,
    facilityId: string,
    path: string,
    params: Record<string, string> = {},
  ) =>
    entries.push({
      kind,
      id,
      label,
      facilityId,
      href: path + '?' + new URLSearchParams({ facility: facilityId, ...params }),
    });
  for (const robot of Object.values(state.robots))
    add('robot', robot.id, robot.id, robot.facilityId, '/fleet', { robot: robot.id });
  for (const mission of Object.values(state.missions))
    add('mission', mission.id, mission.id, mission.facilityId, '/execution', {
      robot: mission.robotId,
    });
  for (const job of Object.values(state.jobs))
    add('job', job.id, job.title, job.facilityId, '/scheduler', { job: job.id });
  for (const facility of Object.values(state.facilities))
    add('facility', facility.id, facility.name, facility.id, '/facilities');
  for (const fault of Object.values(state.faults))
    add('fault', fault.id, fault.message, state.robots[fault.robotId].facilityId, '/faults', {
      robot: fault.robotId,
    });
  for (const charger of Object.values(state.chargers))
    add('charger', charger.id, charger.name, charger.facilityId, '/charging');
  for (const resource of Object.values(state.resources))
    add('resource', resource.id, resource.name, resource.facilityId, '/resources', {
      resource: resource.id,
    });
  for (const order of Object.values(state.maintenance))
    add(
      'maintenance',
      order.id,
      order.technician,
      state.robots[order.robotId].facilityId,
      '/maintenance',
      { robot: order.robotId },
    );
  return entries.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}
export function searchIndex(
  index: readonly SearchEntry[],
  query: string,
  actor: Actor,
  limit = 40,
) {
  const text = query.trim().toLowerCase();
  if (!text) return [];
  return index
    .filter(
      (entry) =>
        (actor.facilityIds === undefined || actor.facilityIds.includes(entry.facilityId)) &&
        (entry.id + ' ' + entry.label + ' ' + entry.kind).toLowerCase().includes(text),
    )
    .slice(0, Math.max(0, Math.min(100, limit)));
}
