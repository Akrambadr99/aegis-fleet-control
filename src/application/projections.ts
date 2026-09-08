import type { Actor, Activity, DomainState } from '../domain/model';
import { readiness } from '../domain/eligibility';
import { buildSearchIndex } from './search';
export function getFleetOperationalProjection(state: DomainState, facilityId: string) {
  const robots = Object.values(state.robots).filter((robot) => robot.facilityId === facilityId);
  return {
    robots,
    ready: robots.filter((robot) => readiness(state, robot).length === 0),
    attention: robots.filter((robot) => readiness(state, robot).length > 0),
  };
}
export function getMissionExecutionProjection(state: DomainState, floorId: string) {
  return Object.values(state.robots)
    .filter((robot) => robot.floorId === floorId)
    .flatMap((robot) => {
      const mission = state.missions[robot.activeMissionId ?? robot.lastMissionId ?? ''];
      return mission ? [mission] : [];
    });
}
export function notificationSeverity(event: Activity): 'critical' | 'warning' | null {
  if (event.type === 'robot.stop' || event.type === 'automation.failed') return 'critical';
  if (/low-battery|control.lost|expired|displaced/.test(event.type)) return 'warning';
  return null;
}
export interface OperationalAlert {
  id: string;
  entityId: string;
  facilityId: string;
  severity: 'critical' | 'warning';
  message: string;
  correlationId?: string;
}

function eventFacility(
  state: DomainState,
  event: Activity,
  indexedFacilities: ReadonlyMap<string, string>,
) {
  const indexed = indexedFacilities.get(event.entityId);
  if (indexed) return indexed;
  const rule = state.automationRules[event.entityId];
  if (rule) return rule.facilityId;
  const route = state.routes[event.entityId];
  if (route) return route.facilityId;
  const floor = state.floors[event.entityId];
  if (floor) return floor.facilityId;
  const corridor = state.corridors[event.entityId];
  if (corridor) return state.floors[corridor.floorId]?.facilityId;
  const lease = state.leases[event.entityId];
  if (lease) return state.robots[lease.robotId]?.facilityId;
  const reservation = state.reservations[event.entityId];
  if (reservation) return state.robots[reservation.robotId]?.facilityId;
  const resourceReservation = state.resourceReservations[event.entityId];
  if (resourceReservation) return state.resources[resourceReservation.resourceId]?.facilityId;
  return undefined;
}

export function projectOperationalAlerts(
  state: DomainState,
  events: readonly Activity[],
): OperationalAlert[] {
  const candidates = events.flatMap((event) => {
    const severity = notificationSeverity(event);
    return severity ? [{ event, severity }] : [];
  });
  if (!candidates.length) return [];
  const indexedFacilities = new Map(
    buildSearchIndex(state).map((entry) => [entry.id, entry.facilityId]),
  );
  return candidates.flatMap(({ event, severity }) => {
    const facilityId = eventFacility(state, event, indexedFacilities);
    if (!facilityId) return [];
    return [
      {
        id: event.id,
        entityId: event.entityId,
        facilityId,
        severity,
        message: event.details,
        correlationId: event.correlationId,
      },
    ];
  });
}

export function filterOperationalAlerts(alerts: readonly OperationalAlert[], actor: Actor) {
  return alerts
    .filter(
      (alert) => actor.facilityIds === undefined || actor.facilityIds.includes(alert.facilityId),
    )
    .slice(-20)
    .reverse();
}
