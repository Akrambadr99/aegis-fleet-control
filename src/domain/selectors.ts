import { resourcesOwned } from './resources';
import type { DomainState, Role, Command } from './model';
import { robotPath } from './navigation';
import { estimateJourney, missionTravel } from './motion';
import { readiness, capabilityIssues } from './eligibility';
export { readiness } from './eligibility';
export function canExecute(role: Role, type: Command['type']) {
  if (role === 'administrator') return true;
  if (type === 'dispatch-lock.takeover') return false;
  if (type.startsWith('dispatch-lock.')) return role === 'fleet-manager';
  if (type.startsWith('automation.')) return role === 'fleet-manager';
  if (type === 'robot.connection') return false;
  if (type === 'resource.set') return role === 'facility-manager';
  if (type.startsWith('job.')) return role === 'fleet-manager';
  if (type.startsWith('job-group.')) return role === 'fleet-manager';
  if (type === 'plan.save') return role === 'fleet-manager';
  if (type === 'template.create') return role === 'fleet-manager';
  if (type.startsWith('maintenance.')) return role === 'fleet-manager';
  if (type === 'corridor.set' || type === 'charger.set') return role === 'facility-manager';
  return role === 'operator' || role === 'fleet-manager';
}
export function missionFeasibility(state: DomainState, missionId: string) {
  const mission = state.missions[missionId],
    robot = state.robots[mission.robotId],
    route = state.routes[mission.routeId];
  const reasons = [
    ...readiness(state, robot),
    ...capabilityIssues(robot, mission.requirements ?? { payloadKg: 0, actions: ['navigate'] }),
  ];
  if (!resourcesOwned(state, robot.id, mission.id, route.resourceIds ?? []))
    reasons.push('Required resource ownership unavailable');
  const estimate = estimateJourney(robot, missionTravel(state, mission), mission.progress),
    distance = estimate.distance;
  if (route.corridorIds.some((id) => !state.corridors[id].open)) reasons.push('Corridor closed');
  if (route.state === 'invalid') reasons.push('Route requires validation');
  const required = estimate.batteryRequired;
  if (robot.battery < required + estimate.reservePercent) {
    reasons.push('Insufficient mission reserve');
    if (!Object.values(state.chargers).some((c) => c.floorId === robot.floorId && c.available))
      reasons.push('No available charger on floor');
  }
  return {
    feasible: reasons.length === 0,
    reasons,
    distance,
    batteryRequired: required,
    etaSeconds: Math.ceil(estimate.seconds),
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
