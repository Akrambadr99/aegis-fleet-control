import { isResourceCommand, applyResource, releaseRobotResources } from './resources';
import { isJobCommand, applyJob } from './jobs';
import { validatePlan } from './planning';
import type { Actor, AuditChange, Command, DomainState, Robot } from './model';
import { missionFeasibility, routeCandidates } from './selectors';
import { GatewayError } from '../gateway/requests';
import { commandPermission } from './permissions';
import { captureEntities, changedEntities } from './audit';
import { robotPath } from './navigation';
import { applyMaintenance, maintenanceReasons } from './maintenance';
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
  changes?: AuditChange[],
) {
  const event = {
    id: `EV-${state.revision}-${state.activity.length}`,
    tick: state.tick,
    actorId: actor.id,
    type,
    entityId,
    details,
    timestamp: new Date(Date.UTC(2026, 0, 1) + state.tick * 1000).toISOString(),
    actorRole: actor.role,
    reason: details,
    changes,
  };
  state.activity.push(event);
  robots.forEach((robot) => frame(state, robot, event.id));
}
export function applyCommand(state: DomainState, actor: Actor, command: Command) {
  const denied = commandPermission(state, actor, command);
  if (denied)
    throw new GatewayError(denied === 'Entity no longer exists' ? 'missing' : 'forbidden', denied);
  if (isResourceCommand(command)) {
    const before = captureEntities(state);
    const robots = applyResource(state, command);
    record(
      state,
      actor,
      command.type,
      command.id,
      'Facility resource ownership updated',
      [...new Map(robots.map((r) => [r.id, r])).values()],
      changedEntities(before, state),
    );
    return;
  }
  if (isJobCommand(command)) {
    const before = captureEntities(state);
    const robots = applyJob(state, command);
    record(
      state,
      actor,
      command.type,
      command.id,
      state.jobs[command.id].assignmentReason || state.jobs[command.id].title,
      robots,
      changedEntities(before, state),
    );
    return;
  }
  if (command.type === 'plan.save') {
    const existing = state.plans[command.id];
    if ((existing?.revision ?? 0) !== command.expectedRevision)
      throw new GatewayError('stale', 'Mission plan changed; reload before saving');
    if (
      command.id !== command.plan.id ||
      (existing && existing.facilityId !== command.plan.facilityId)
    )
      throw new GatewayError('invalid', 'Mission identity and facility cannot change');
    const validation = validatePlan(state, command.plan);
    if (validation.issues.length)
      throw new GatewayError('invalid', validation.issues.map((i) => i.message).join('; '));
    const before = captureEntities(state);
    state.plans[command.id] = {
      ...structuredClone(command.plan),
      revision: command.expectedRevision + 1,
    };
    record(
      state,
      actor,
      command.type,
      command.id,
      'Saved mission plan: ' + command.plan.title,
      [state.robots[command.plan.robotId]],
      changedEntities(before, state),
    );
    return;
  }
  const table = command.type.startsWith('maintenance.')
    ? state.maintenance
    : command.type === 'corridor.set'
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
  const before = captureEntities(state);
  const impacted: Robot[] = [];
  if (
    command.type === 'maintenance.start' ||
    command.type === 'maintenance.verify' ||
    command.type === 'maintenance.complete'
  ) {
    impacted.push(...applyMaintenance(state, command));
  } else if (command.type === 'corridor.set') {
    const corridor = state.corridors[command.id];
    if (corridor.open === command.open)
      throw new GatewayError('unchanged', 'Corridor already has this state');
    corridor.open = command.open;
    const facility = state.facilities[state.floors[corridor.floorId].facilityId];
    facility.topologyRevision++;
    facility.revision++;
    for (const route of Object.values(state.routes)) {
      if (!route.corridorIds.includes(corridor.id)) continue;
      const active = state.robots[route.robotId].activeMissionId;
      if (
        !active ||
        state.missions[active].routeId !== route.id ||
        state.missions[active].status === 'completed'
      )
        continue;
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
        if (
          reservation.chargerId !== charger.id ||
          reservation.state === 'displaced' ||
          reservation.state === 'released'
        )
          continue;
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
      releaseRobotResources(state, robot.id);
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
    } else if (command.type === 'robot.reroute') {
      if (
        !mission ||
        !route ||
        robot.status === 'emergency-stopped' ||
        mission.status === 'completed'
      )
        throw new GatewayError('invalid', 'Robot must have a recoverable active mission');
      if (maintenanceReasons(state, robot).length)
        throw new GatewayError('invalid', 'Route ownership is unavailable during maintenance');
      const candidates = routeCandidates(state, robot.id);
      if (!candidates.length)
        throw new GatewayError('invalid', 'No open transfer lane on this floor');
      const path = robotPath(state, robot.id)!;
      route.nodeIds = path.nodeIds;
      route.edgeIds = path.edgeIds;
      route.origin = { ...robot.position };
      mission.progress = 0;
      route.corridorIds = candidates;
      route.topologyRevision = state.facilities[robot.facilityId].topologyRevision;
      route.state = 'valid';
      route.reservationState = mission.status === 'running' ? 'active' : 'held';
      route.revision++;
      mission.revision++;
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
    changedEntities(before, state),
  );
}
