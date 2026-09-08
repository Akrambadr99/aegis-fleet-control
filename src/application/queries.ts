import type { DomainState } from '../domain/model';
/** Explicit dependency signature shared by query cache and asynchronous stale-result guard. */
export function routePreviewKey(state: DomainState, id: string | null) {
  const robot = state.robots[id ?? ''];
  const order = robot?.maintenanceOrderId ? state.maintenance[robot.maintenanceOrderId] : undefined;
  return [
    'route-preview',
    id,
    robot?.revision,
    robot && state.facilities[robot.facilityId]?.topologyRevision,
    robot?.faultIds.map((id) => state.faults[id]?.revision).join(','),
    robot?.chargerReservationId && state.reservations[robot.chargerReservationId]?.revision,
    order?.revision,
    order?.status === 'scheduled' ? state.tick >= order.dueTick : false,
  ] as const;
}
export const dependencyGraph = {
  topology: ['routes'],
  routes: ['missionFeasibility'],
  missionFeasibility: ['trafficProjection', 'simulation'],
  robot: ['routePreview', 'missionFeasibility', 'scheduler'],
  reservation: ['routePreview', 'scheduler'],
} as const;
