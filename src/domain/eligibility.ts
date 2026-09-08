import type { DomainState, Robot } from './model';

export function capabilityIssues(
  robot: Robot,
  requirements: { payloadKg: number; actions: string[] },
) {
  const reasons: string[] = [];
  if (requirements.payloadKg > robot.capabilities.payloadKg)
    reasons.push('Payload exceeds robot capacity');
  for (const action of requirements.actions)
    if (!robot.capabilities.actions.includes(action)) reasons.push('Unsupported action: ' + action);
  return reasons;
}
export function maintenanceReasons(state: DomainState, robot: Robot) {
  const order = robot.maintenanceOrderId ? state.maintenance[robot.maintenanceOrderId] : null;
  if (order?.status === 'in-progress' || order?.status === 'verification')
    return ['Robot under maintenance'];
  if (order?.status === 'scheduled' && order.dueTick <= state.tick) return ['Maintenance overdue'];
  return [];
}
export function readiness(state: DomainState, robot: Robot): string[] {
  const reasons = maintenanceReasons(state, robot);
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
