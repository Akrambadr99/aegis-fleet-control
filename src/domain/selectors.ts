import type { DomainState, Robot, Role, Command } from './model';
import { robotPath, routeDistance } from './navigation';
import { maintenanceReasons, capabilityIssues } from './maintenance';
export function canExecute(role: Role, type: Command['type']) {
  if (role === 'administrator') return true;
  if (type.startsWith('maintenance.')) return role === 'fleet-manager';
  if (type === 'corridor.set' || type === 'charger.set') return role === 'facility-manager';
  return role === 'operator' || role === 'fleet-manager';
}
export function readiness(state: DomainState, robot: Robot): string[] {
  const reasons: string[] = maintenanceReasons(state, robot);
  if (!robot.connected) reasons.push('Connection lost');
  if (robot.status === 'emergency-stopped') reasons.push('Emergency stop latched');
  if (robot.battery < 20) reasons.push('Low battery');
  if (robot.controlSessionId) reasons.push('Manual control owned');
  if (robot.faultIds.some((id) => state.faults[id]?.status !== 'resolved'))
    reasons.push('Active fault');
  const reservation = robot.chargerReservationId
    ? state.reservations[robot.chargerReservationId]
    : null;
  if (reservation?.state === 'displaced') reasons.push('Charging reservation displaced');
  return reasons;
}
export function missionFeasibility(state: DomainState, missionId: string) {
  const mission = state.missions[missionId],
    robot = state.robots[mission.robotId],
    route = state.routes[mission.routeId];
  const reasons = [
    ...readiness(state, robot),
    ...capabilityIssues(robot, mission.requirements ?? { payloadKg: 0, actions: ['navigate'] }),
  ];
  const distance = routeDistance(state, route);
  if (route.corridorIds.some((id) => !state.corridors[id].open)) reasons.push('Corridor closed');
  if (route.state === 'invalid') reasons.push('Route requires validation');
  const required = distance * 0.12;
  if (robot.battery < required + 10) {
    reasons.push('Insufficient mission reserve');
    if (!Object.values(state.chargers).some((c) => c.floorId === robot.floorId && c.available))
      reasons.push('No available charger on floor');
  }
  return {
    feasible: reasons.length === 0,
    reasons,
    distance,
    batteryRequired: required,
    etaSeconds: Math.ceil(distance / 1.2),
  };
}
export function simulationInputs(state: DomainState, facilityId: string) {
  return {
    facilityId,
    topologyRevision: state.facilities[facilityId].topologyRevision,
    robotCount: Object.values(state.robots).filter((r) => r.facilityId === facilityId).length,
    availableChargers: Object.values(state.chargers).filter(
      (c) => c.facilityId === facilityId && c.available,
    ).length,
    closedCorridors: Object.values(state.corridors)
      .filter((c) => state.floors[c.floorId].facilityId === facilityId && !c.open)
      .map((c) => c.id),
  };
}
export function trafficConflicts(state: DomainState, facilityId: string) {
  return Object.values(state.routes).filter(
    (route) =>
      route.facilityId === facilityId &&
      route.reservationState !== 'released' &&
      route.corridorIds.some((id) => !state.corridors[id].open),
  );
}

// The initial topology models three alternative transfer lanes on each floor.
export function routeCandidates(state: DomainState, robotId: string) {
  return robotPath(state, robotId)?.corridorIds ?? [];
}
