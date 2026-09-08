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
export function getOperationalNotifications(state: DomainState, actor: Actor) {
  const facilities = new Map(buildSearchIndex(state).map((entry) => [entry.id, entry.facilityId]));
  return state.activity
    .flatMap((event) => {
      const severity = notificationSeverity(event);
      const facility = facilities.get(event.entityId);
      if (
        !severity ||
        (actor.facilityIds !== undefined && (!facility || !actor.facilityIds.includes(facility)))
      )
        return [];
      return [
        {
          id: event.id,
          entityId: event.entityId,
          severity,
          message: event.details,
          correlationId: event.correlationId,
        },
      ];
    })
    .slice(-20)
    .reverse();
}
