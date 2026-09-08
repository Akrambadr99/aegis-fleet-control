import type { Command, DomainState, Robot } from './model';
import { GatewayError } from '../gateway/requests';
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
export function applyMaintenance(
  state: DomainState,
  command: Extract<
    Command,
    { type: 'maintenance.start' | 'maintenance.verify' | 'maintenance.complete' }
  >,
) {
  const order = state.maintenance[command.id],
    robot = state.robots[order.robotId];
  if (robot.status === 'emergency-stopped')
    throw new GatewayError('invalid', 'Emergency stop requires safety recovery');
  const expected = {
    'maintenance.start': 'scheduled',
    'maintenance.verify': 'in-progress',
    'maintenance.complete': 'verification',
  }[command.type];
  if (order.status !== expected)
    throw new GatewayError('invalid', 'Maintenance transition is not allowed');
  if (command.type === 'maintenance.start') {
    order.status = 'in-progress';
    robot.status = 'maintenance';
    const mission = robot.activeMissionId ? state.missions[robot.activeMissionId] : null;
    if (mission && mission.status !== 'completed') {
      mission.status = 'paused';
      mission.pauseReason = 'Robot under maintenance';
      mission.revision++;
      const route = state.routes[mission.routeId];
      route.reservationState = 'released';
      route.revision++;
    }
    if (robot.chargerReservationId) {
      const reservation = state.reservations[robot.chargerReservationId];
      reservation.state = 'released';
      reservation.revision++;
      robot.chargerReservationId = null;
    }
    if (robot.controlSessionId) {
      state.leases[robot.controlSessionId].state = 'released';
      state.leases[robot.controlSessionId].revision++;
      robot.controlSessionId = null;
    }
  } else if (command.type === 'maintenance.verify') {
    order.status = 'verification';
  } else {
    order.status = 'completed';
    const mission = robot.activeMissionId ? state.missions[robot.activeMissionId] : null;
    robot.status = mission && mission.status === 'paused' ? 'paused' : 'idle';
  }
  robot.revision++;
  return [robot];
}
export function seedMaintenance(state: DomainState) {
  for (const robot of Object.values(state.robots)) {
    const id = 'SVC-' + robot.id;
    robot.maintenanceOrderId = id;
    state.maintenance[id] = {
      id,
      revision: 1,
      robotId: robot.id,
      dueTick: 1000 + Number(robot.id.slice(2)),
      technician: 'Service team',
      status: 'scheduled',
    };
  }
}
