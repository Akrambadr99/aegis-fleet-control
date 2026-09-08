import type { DomainState } from './model';
import { shortestPath } from './navigation';

export function canReachFacilityTarget(
  state: DomainState,
  origin: string | undefined,
  target: { floorId: string; zoneId?: string },
) {
  if (!origin) return false;
  return Object.values(state.navigationNodes).some(
    (node) =>
      node.floorId === target.floorId &&
      (!target.zoneId || node.zoneId === target.zoneId) &&
      shortestPath(state, origin, node.id) !== null,
  );
}

export function resourceDispatchIssues(state: DomainState, resourceId: string, robotId: string) {
  const resource = state.resources[resourceId];
  const owners = Object.values(state.resourceReservations).filter(
    (reservation) => reservation.resourceId === resourceId && reservation.state === 'owned',
  );
  if (
    !owners.some((reservation) => reservation.robotId === robotId) &&
    owners.length >= resource.capacity
  )
    return ['Resource ' + resourceId + ' is at capacity'];
  return [];
}
