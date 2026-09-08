import type { Robot, Charger } from './model';
import type { FacilityResource } from './resources';
export const capabilityRegistry = {
  navigate: { robotAction: 'navigate' },
  pickup: { robotAction: 'lift' },
  dropoff: { robotAction: 'lift' },
  inspect: { robotAction: 'inspect' },
} as const;
export type RobotAction =
  (typeof capabilityRegistry)[keyof typeof capabilityRegistry]['robotAction'];
export function supportsRobotAction(robot: Robot, action: RobotAction, payloadKg = 0) {
  return robot.capabilities.actions.includes(action) && payloadKg <= robot.capabilities.payloadKg;
}
export function chargerCapabilities(charger: Charger) {
  return { charge: charger.available };
}
export function resourceCapabilities(resource: FacilityResource) {
  return { kind: resource.kind, available: resource.available, capacity: resource.capacity };
}

export function supportsMissionAction(
  robot: Robot,
  action: keyof typeof capabilityRegistry,
  payloadKg = 0,
) {
  return supportsRobotAction(robot, capabilityRegistry[action].robotAction, payloadKg);
}
