import type { Actor, Command, DomainState, Robot } from './model';
import { canExecute, missionFeasibility } from './selectors';
import { GatewayError } from '../gateway/requests';
function frame(state: DomainState, robot: Robot, eventId: string) {
  const mission = robot.activeMissionId ? state.missions[robot.activeMissionId] : null;
  state.replay.push({
    tick: state.tick,
    robotId: robot.id,
    status: robot.status,
    missionStatus: mission?.status ?? null,
    position: { ...robot.position },
    battery: robot.battery,
    routeReservation: mission ? state.routes[mission.routeId].reservationState : null,
    eventId,
  });
}
export function record(
  state: DomainState,
  actor: Actor,
  type: string,
  entityId: string,
  details: string,
  robots: Robot[],
) {
  const event = {
    id: `EV-${state.revision}-${state.activity.length}`,
    tick: state.tick,
    actorId: actor.id,
    type,
    entityId,
    details,
  };
  state.activity.push(event);
  robots.forEach((robot) => frame(state, robot, event.id));
}
export function applyCommand(state: DomainState, actor: Actor, command: Command) {
  if (!canExecute(actor.role, command.type))
    throw new GatewayError('forbidden', 'Your role cannot execute this command');
  const table =
    command.type === 'corridor.set'
      ? state.corridors
      : command.type === 'charger.set'
        ? state.chargers
        : command.type === 'fault.acknowledge'
          ? state.faults
          : state.robots;
  const entity = table[command.id];
  if (!entity) throw new GatewayError('missing', 'Entity no longer exists');
  if (entity.revision !== command.expectedRevision)
    throw new GatewayError('stale', 'Entity changed; review its current revision and retry');
  const impacted: Robot[] = [];
  if (command.type === 'corridor.set') {
    const corridor = state.corridors[command.id];
    if (corridor.open === command.open)
      throw new GatewayError('unchanged', 'Corridor already has this state');
    corridor.open = command.open;
    const facility = state.facilities[state.floors[corridor.floorId].facilityId];
    facility.topologyRevision++;
    facility.revision++;
    for (const route of Object.values(state.routes)) {
      if (!route.corridorIds.includes(corridor.id)) continue;
      route.state = 'invalid';
      route.revision++;
      const robot = state.robots[route.robotId],
        mission = robot.activeMissionId ? state.missions[robot.activeMissionId] : null;
      if (
        !command.open &&
        mission &&
        mission.routeId === route.id &&
        mission.status === 'running'
      ) {
        mission.status = 'paused';
        mission.pauseReason = 'Corridor closed';
        mission.revision++;
        robot.status = 'paused';
        robot.revision++;
        route.reservationState = 'held';
      }
      impacted.push(robot);
    }
  } else if (command.type === 'charger.set') {
    const charger = state.chargers[command.id];
    if (charger.available === command.available)
      throw new GatewayError('unchanged', 'Charger already has this state');
    charger.available = command.available;
    if (!command.available)
      for (const reservation of Object.values(state.reservations)) {
        if (reservation.chargerId !== charger.id || reservation.state === 'displaced') continue;
        reservation.state = 'displaced';
        reservation.revision++;
        const robot = state.robots[reservation.robotId];
        robot.revision++;
        if (robot.status === 'charging') robot.status = 'paused';
        impacted.push(robot);
      }
  } else if (command.type === 'fault.acknowledge') {
    const fault = state.faults[command.id];
    if (fault.status !== 'active')
      throw new GatewayError('unchanged', 'Fault is already acknowledged or resolved');
    fault.status = 'acknowledged';
    fault.acknowledgedBy = actor.id;
    impacted.push(state.robots[fault.robotId]);
  } else {
    const robot = state.robots[command.id];
    if (!robot.connected) throw new GatewayError('offline', 'Robot connection lost');
    const mission = robot.activeMissionId ? state.missions[robot.activeMissionId] : null;
    const route = mission ? state.routes[mission.routeId] : null;
    if (command.type === 'robot.stop') {
      if (robot.status === 'emergency-stopped')
        throw new GatewayError('unchanged', 'Robot is already emergency stopped');
      robot.status = 'emergency-stopped';
      if (mission && mission.status !== 'completed') {
        mission.status = 'paused';
        mission.pauseReason = 'Emergency stop';
        mission.revision++;
      }
      if (route) {
        route.reservationState = 'released';
        route.revision++;
      }
      if (robot.controlSessionId) {
        const lease = state.leases[robot.controlSessionId];
        lease.state = 'released';
        lease.revision++;
        robot.controlSessionId = null;
      }
    } else if (command.type === 'robot.pause') {
      if (robot.status !== 'running')
        throw new GatewayError('unchanged', 'Only a running robot can be paused');
      robot.status = 'paused';
      if (mission) {
        mission.status = 'paused';
        mission.pauseReason = 'Operator pause';
        mission.revision++;
      }
      if (route) {
        route.reservationState = 'held';
        route.revision++;
      }
    } else {
      if (robot.status !== 'paused' || !mission)
        throw new GatewayError('invalid', 'Only a paused mission can resume');
      const feasibility = missionFeasibility(state, mission.id);
      if (!feasibility.feasible) throw new GatewayError('invalid', feasibility.reasons.join('; '));
      robot.status = 'running';
      mission.status = 'running';
      mission.pauseReason = null;
      mission.revision++;
      if (route) {
        route.reservationState = 'active';
        route.revision++;
      }
    }
    impacted.push(robot);
  }
  entity.revision++;
  record(
    state,
    actor,
    command.type,
    command.id,
    `${command.type} applied; ${impacted.length} robot(s) affected`,
    impacted,
  );
}
