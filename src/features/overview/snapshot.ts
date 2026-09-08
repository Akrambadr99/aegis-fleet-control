import { getFleetOperationalProjection } from '../../application/projections';
import type { DomainState } from '../../domain/model';
export const facilities = [
  { id: 'northstar', domainId: 'FAC-001' },
  { id: 'meridian', domainId: 'FAC-002' },
  { id: 'atlas', domainId: 'FAC-003' },
  { id: 'harbor', domainId: 'FAC-004' },
] as const;
export function resolveFacility(state: DomainState, id: string | null) {
  const entry = facilities.find((f) => f.id === id || f.domainId === id) ?? facilities[0],
    facility = state.facilities[entry.domainId],
    floor = state.floors[facility.floorIds[0]];
  const operational = getFleetOperationalProjection(state, facility.id);
  const robots = operational.robots,
    missions = Object.values(state.missions).filter((m) => m.facilityId === facility.id);
  const active = robots.filter((r) => r.status === 'running').length,
    charging = robots.filter((r) => r.status === 'charging').length,
    offline = robots.filter((r) => !r.connected).length;
  const attention = robots.filter(
    (r) =>
      r.faultIds.some((id) => state.faults[id].status !== 'resolved') ||
      r.status === 'emergency-stopped' ||
      (r.chargerReservationId && state.reservations[r.chargerReservationId].state === 'displaced'),
  ).length;
  return {
    id: entry.id,
    domainId: facility.id,
    floorId: floor.id,
    name: facility.name,
    location: `${facility.id} · Local operating facility`,
    floors: facility.floorIds.map((id) => state.floors[id].name),
    fleet: robots.length,
    online: robots.length - offline,
    offline,
    active,
    charging,
    attention,
    missions: missions.filter((m) => m.status === 'completed').length,
    throughput: Math.round((active / robots.length) * 100),
    available: operational.ready.filter((r) => r.status === 'idle').length,

    activity: Object.values(state.faults)
      .filter((f) => state.robots[f.robotId].facilityId === facility.id && f.status !== 'resolved')
      .map((f) => `${f.robotId}: ${f.message}`)
      .concat(
        robots
          .filter((r) => r.status === 'emergency-stopped')
          .map((r) => `${r.id}: Emergency stop latched`),
      )
      .concat(
        robots
          .filter(
            (r) =>
              r.chargerReservationId &&
              state.reservations[r.chargerReservationId].state === 'displaced',
          )
          .map((r) => `${r.id}: Charging reservation displaced`),
      ),
    nodes: floor.zoneIds.map((id) => state.zones[id]),
    robots: robots.filter((r) => r.floorId === floor.id),
    corridors: floor.corridorIds.map((id) => state.corridors[id]),
  };
}
export type FacilitySnapshot = ReturnType<typeof resolveFacility>;
