import { renewLease } from './ownership';
import type { Actor, Command, DomainState, Robot } from './model';
import { readiness } from './selectors';
import { releaseRobotResources } from './resources';
import { DomainError as GatewayError } from './errors';
export type ControlCommand =
  | { type: 'control.acquire'; id: string; expectedRevision: number; duration: number }
  | { type: 'control.renew'; id: string; expectedRevision: number; duration: number }
  | { type: 'control.takeover'; id: string; expectedRevision: number; duration: number }
  | { type: 'control.release'; id: string; expectedRevision: number }
  | { type: 'control.move'; id: string; expectedRevision: number; dx: number; dy: number }
  | { type: 'robot.connection'; id: string; expectedRevision: number; connected: boolean };
export function isControlCommand(command: Command): command is ControlCommand {
  return command.type.startsWith('control.') || command.type === 'robot.connection';
}
function pauseMission(state: DomainState, robot: Robot, reason: string) {
  const mission = robot.activeMissionId ? state.missions[robot.activeMissionId] : null;
  if (mission && !['completed', 'cancelled'].includes(mission.status)) {
    mission.status = 'paused';
    mission.pauseReason = reason;
    mission.revision++;
    const route = state.routes[mission.routeId];
    route.reservationState = 'released';
    route.revision++;
  }
  releaseRobotResources(state, robot.id);
}
export function releaseControl(state: DomainState, robot: Robot, reason: string) {
  if (robot.controlSessionId) {
    const lease = state.leases[robot.controlSessionId];
    lease.state = 'released';
    lease.revision++;
    robot.controlSessionId = null;
  }
  if (robot.status === 'manual') {
    const mission = robot.activeMissionId ? state.missions[robot.activeMissionId] : null;
    robot.status =
      mission && !['completed', 'cancelled'].includes(mission.status) ? 'paused' : 'idle';
    pauseMission(state, robot, reason);
  }
  robot.revision++;
}
export function synchronizeControls(state: DomainState) {
  const events: { robot: Robot; reason: string }[] = [];
  for (const robot of Object.values(state.robots)) {
    const lease = robot.controlSessionId ? state.leases[robot.controlSessionId] : null;
    if (lease && (lease.expiresAt <= state.tick || !robot.connected || robot.status !== 'manual')) {
      const reason = !robot.connected
        ? 'Connection lost'
        : lease.expiresAt <= state.tick
          ? 'Control lease expired'
          : 'Control ownership lost';
      releaseControl(state, robot, reason);
      events.push({ robot, reason });
    }
  }
  return events;
}
export function applyControl(state: DomainState, actor: Actor, command: ControlCommand): Robot[] {
  const robot = state.robots[command.id];
  if (!robot) throw new GatewayError('missing', 'Robot not found');
  if (robot.revision !== command.expectedRevision)
    throw new GatewayError('stale', 'Robot changed; review current control state');
  const lease = robot.controlSessionId ? state.leases[robot.controlSessionId] : null;
  if (command.type === 'robot.connection') {
    if (robot.connected === command.connected)
      throw new GatewayError('unchanged', 'Connection already has this state');
    robot.connected = command.connected;
    const faultId = 'COMMS-' + robot.id;
    if (!command.connected) {
      releaseControl(state, robot, 'Connection lost');
      pauseMission(state, robot, 'Connection lost');
      if (robot.status === 'running') robot.status = 'paused';
      const previous = state.faults[faultId];
      state.faults[faultId] = {
        id: faultId,
        revision: (previous?.revision ?? 0) + 1,
        robotId: robot.id,
        severity: 'critical',
        status: 'active',
        message: 'Control link disconnected',
        acknowledgedBy: null,
      };
      if (!robot.faultIds.includes(faultId)) robot.faultIds.push(faultId);
    } else if (state.faults[faultId]) {
      state.faults[faultId].status = 'resolved';
      state.faults[faultId].revision++;
    }
  } else if (command.type === 'control.acquire' || command.type === 'control.takeover') {
    if (command.type === 'control.takeover') {
      if (actor.role !== 'administrator')
        throw new GatewayError(
          'forbidden',
          'Only an administrator may take over control',
          'ownership',
        );
      releaseControl(state, robot, 'Control taken over');
    }
    if (
      lease &&
      lease.state === 'active' &&
      lease.expiresAt > state.tick &&
      command.type !== 'control.takeover'
    )
      throw new GatewayError(
        'conflict',
        'Control is already owned by ' + lease.ownerId,
        'ownership',
      );
    const reasons = readiness(state, robot);
    if (reasons.length) throw new GatewayError('invalid', reasons.join('; '));
    if (!Number.isInteger(command.duration) || command.duration < 1 || command.duration > 300)
      throw new GatewayError('invalid', 'Control duration must be 1–300 seconds');
    pauseMission(state, robot, 'Manual control acquired');
    const id = 'CTRL-' + robot.id + '-' + robot.revision;
    state.leases[id] = {
      id,
      revision: 1,
      robotId: robot.id,
      ownerId: actor.id,
      acquiredAt: state.tick,
      expiresAt: state.tick + command.duration,
      state: 'active',
    };
    robot.controlSessionId = id;
    robot.status = 'manual';
  } else {
    if (
      !lease ||
      lease.state !== 'active' ||
      lease.expiresAt <= state.tick ||
      robot.status !== 'manual'
    )
      throw new GatewayError('invalid', 'No active control ownership', 'ownership');
    if (
      lease.ownerId !== actor.id &&
      !(command.type === 'control.release' && actor.role === 'administrator')
    )
      throw new GatewayError('forbidden', 'Control belongs to another operator');
    if (command.type === 'control.renew') {
      Object.assign(lease, renewLease(lease, actor.id, state.tick, command.duration));
      lease.revision++;
      robot.revision++;
      return [robot];
    }
    if (command.type === 'control.release') {
      releaseControl(state, robot, 'Manual control released');
      return [robot];
    }
    if (!robot.connected) throw new GatewayError('offline', 'Robot connection lost');
    if (
      !Number.isFinite(command.dx) ||
      !Number.isFinite(command.dy) ||
      Math.abs(command.dx) > 1 ||
      Math.abs(command.dy) > 1 ||
      (!command.dx && !command.dy)
    )
      throw new GatewayError('invalid', 'Motion requires a bounded direction');
    if (robot.battery <= 10)
      throw new GatewayError('invalid', 'Manual motion battery reserve reached');
    const norm = Math.max(1, Math.hypot(command.dx, command.dy)),
      distance = robot.capabilities.maxSpeed * 0.25;
    const next = {
      x: Number((robot.position.x + (command.dx / norm) * distance).toFixed(3)),
      y: Number((robot.position.y + (command.dy / norm) * distance).toFixed(3)),
    };
    const zones = state.floors[robot.floorId].zoneIds.map((id) => state.zones[id]);
    if (
      next.x < 0 ||
      next.y < 0 ||
      next.x > Math.max(...zones.map((z) => z.x)) + 60 ||
      next.y > Math.max(...zones.map((z) => z.y)) + 60
    )
      throw new GatewayError('invalid', 'Motion exceeds the facility boundary');
    robot.position = next;
    robot.battery = Number(
      (
        robot.battery -
        Math.hypot((command.dx / norm) * distance, (command.dy / norm) * distance) * 0.12
      ).toFixed(4),
    );
    state.telemetry.push({
      robotId: robot.id,
      tick: state.tick,
      battery: robot.battery,
      x: next.x,
      y: next.y,
      velocity: distance / 0.25,
    });
  }
  robot.revision++;
  return [robot];
}
