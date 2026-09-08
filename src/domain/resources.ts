import type { Command, DomainState, Robot, Versioned } from './model';
import { readiness } from './eligibility';
import { DomainError as GatewayError } from './errors';
export type ResourceKind =
  | 'elevator'
  | 'narrow-corridor'
  | 'door'
  | 'dock'
  | 'loading-bay'
  | 'inspection-station';
export interface FacilityResource extends Versioned {
  facilityId: string;
  floorId: string;
  zoneId: string;
  kind: ResourceKind;
  name: string;
  available: boolean;
  capacity: number;
  corridorId: string | null;
}
export interface ResourceReservation extends Versioned {
  resourceId: string;
  robotId: string;
  missionId: string | null;
  state: 'queued' | 'owned' | 'released' | 'expired';
  priority: number;
  requestedTick: number;
  expiresTick: number;
  duration: number;
}
export type ResourceCommand =
  | { type: 'resource.set'; id: string; expectedRevision: number; available: boolean }
  | {
      type: 'resource.request';
      id: string;
      expectedRevision: number;
      robotId: string;
      priority: number;
      duration: number;
    }
  | { type: 'resource.release'; id: string; expectedRevision: number };
export function isResourceCommand(command: Command): command is ResourceCommand {
  return command.type.startsWith('resource.');
}
export function resourceOwners(state: DomainState, id: string) {
  return Object.values(state.resourceReservations).filter(
    (r) => r.resourceId === id && r.state === 'owned',
  );
}
export function resourcesOwned(
  state: DomainState,
  robotId: string,
  missionId: string,
  ids: string[],
) {
  return ids.every((id) =>
    Object.values(state.resourceReservations).some(
      (r) =>
        r.resourceId === id &&
        r.robotId === robotId &&
        r.missionId === missionId &&
        r.state === 'owned' &&
        r.expiresTick > state.tick &&
        state.resources[id].available,
    ),
  );
}
export function releaseRobotResources(state: DomainState, robotId: string, missionId?: string) {
  for (const lease of Object.values(state.resourceReservations))
    if (
      lease.robotId === robotId &&
      (!missionId || lease.missionId === missionId) &&
      ['owned', 'queued'].includes(lease.state)
    ) {
      lease.state = 'released';
      lease.revision++;
      state.resources[lease.resourceId].revision++;
    }
}
function request(
  state: DomainState,
  resourceId: string,
  robot: Robot,
  missionId: string | null,
  priority: number,
  duration: number,
) {
  const id = resourceId + ':' + robot.id + ':' + (missionId ?? 'manual'),
    existing = state.resourceReservations[id];
  if (existing && ['owned', 'queued'].includes(existing.state)) return;
  state.resourceReservations[id] = {
    id,
    revision: (existing?.revision ?? 0) + 1,
    resourceId,
    robotId: robot.id,
    missionId,
    state: 'queued',
    priority,
    requestedTick: state.tick,
    expiresTick: state.tick + duration,
    duration,
  };
  state.resources[resourceId].revision++;
}
export function reserveMissionResources(
  state: DomainState,
  robot: Robot,
  missionId: string,
  ids: string[],
  priority: number,
) {
  state.routes[state.missions[missionId].routeId].resourceIds = [...new Set(ids)];
  for (const id of ids) request(state, id, robot, missionId, priority, 300);
  synchronizeResources(state);
}
export function synchronizeResources(state: DomainState) {
  const events: { robot: Robot; resourceId: string; event: string }[] = [];
  for (const lease of Object.values(state.resourceReservations)) {
    if (!['owned', 'queued'].includes(lease.state)) continue;
    const robot = state.robots[lease.robotId],
      resource = state.resources[lease.resourceId],
      mission = lease.missionId ? state.missions[lease.missionId] : null;
    const unavailable =
      !robot.connected ||
      ['maintenance', 'emergency-stopped'].includes(robot.status) ||
      (!!mission && ['completed', 'cancelled'].includes(mission.status));
    if (lease.expiresTick <= state.tick || unavailable || !resource.available) {
      lease.state = lease.expiresTick <= state.tick ? 'expired' : 'released';
      lease.revision++;
      resource.revision++;
      events.push({ robot, resourceId: resource.id, event: 'resource.' + lease.state });
    }
  }
  const queued = Object.values(state.resourceReservations)
    .filter((r) => r.state === 'queued')
    .sort(
      (a, b) =>
        b.priority - a.priority || a.requestedTick - b.requestedTick || a.id.localeCompare(b.id),
    );
  const considered = new Set<string>();
  for (const lease of queued) {
    const key = lease.robotId + ':' + lease.missionId;
    if (considered.has(key)) continue;
    considered.add(key);
    const group = queued.filter(
      (r) => r.robotId === lease.robotId && r.missionId === lease.missionId,
    );
    if (
      group.some(
        (r) =>
          !state.resources[r.resourceId].available ||
          resourceOwners(state, r.resourceId).length >= state.resources[r.resourceId].capacity,
      )
    )
      continue;
    for (const item of group) {
      item.state = 'owned';
      item.expiresTick = state.tick + item.duration;
      item.revision++;
      state.resources[item.resourceId].revision++;
      events.push({
        robot: state.robots[item.robotId],
        resourceId: item.resourceId,
        event: 'resource.acquired',
      });
    }
  }
  for (const robot of Object.values(state.robots)) {
    const mission = robot.activeMissionId ? state.missions[robot.activeMissionId] : null;
    if (!mission || ['completed', 'cancelled', 'draft'].includes(mission.status)) continue;
    const route = state.routes[mission.routeId],
      required = route.resourceIds ?? [];
    if (!required.length) continue;
    const owned = resourcesOwned(state, robot.id, mission.id, required);
    if (!owned && mission.status === 'running') {
      mission.status = 'paused';
      mission.pauseReason = 'Resource contention';
      mission.revision++;
      if (robot.status === 'running') {
        robot.status = 'paused';
        robot.revision++;
      }
      route.reservationState = 'held';
      route.revision++;
    } else if (
      owned &&
      mission.status === 'paused' &&
      mission.pauseReason === 'Resource contention' &&
      !readiness(state, robot).length &&
      route.state === 'valid'
    ) {
      mission.status = 'running';
      mission.pauseReason = null;
      mission.revision++;
      robot.status = 'running';
      robot.revision++;
      route.reservationState = 'active';
      route.revision++;
    }
  }
  return events;
}
export function applyResource(state: DomainState, command: ResourceCommand): Robot[] {
  if (command.type === 'resource.release') {
    const lease = state.resourceReservations[command.id];
    if (!lease) throw new GatewayError('missing', 'Reservation not found');
    if (lease.revision !== command.expectedRevision)
      throw new GatewayError('stale', 'Reservation changed');
    if (!['owned', 'queued'].includes(lease.state))
      throw new GatewayError('unchanged', 'Reservation already released');
    releaseRobotResources(state, lease.robotId, lease.missionId ?? undefined);
    return [state.robots[lease.robotId], ...synchronizeResources(state).map((e) => e.robot)];
  }
  const resource = state.resources[command.id];
  if (!resource) throw new GatewayError('missing', 'Resource not found');
  if (resource.revision !== command.expectedRevision)
    throw new GatewayError('stale', 'Resource changed; refresh ownership');
  if (command.type === 'resource.set') {
    if (resource.available === command.available)
      throw new GatewayError('unchanged', 'Resource already has this availability');
    resource.available = command.available;
    resource.revision++;
    state.facilities[resource.facilityId].topologyRevision++;
    state.facilities[resource.facilityId].revision++;
    const affected: Robot[] = [];
    if (resource.corridorId)
      for (const route of Object.values(state.routes)) {
        const robot = state.robots[route.robotId],
          mission = robot.activeMissionId ? state.missions[robot.activeMissionId] : null;
        if (
          !route.corridorIds.includes(resource.corridorId) ||
          !mission ||
          mission.routeId !== route.id ||
          ['completed', 'cancelled'].includes(mission.status)
        )
          continue;
        route.state = 'invalid';
        route.revision++;
        if (!resource.available && mission.status === 'running') {
          mission.status = 'paused';
          mission.pauseReason = 'Resource unavailable';
          mission.revision++;
          if (robot.status === 'running') {
            robot.status = 'paused';
            robot.revision++;
          }
          route.reservationState = 'held';
        }
        affected.push(robot);
      }
    return [...affected, ...synchronizeResources(state).map((e) => e.robot)];
  }
  const robot = state.robots[command.robotId];
  if (!robot || robot.facilityId !== resource.facilityId)
    throw new GatewayError('invalid', 'Robot and resource must share a facility');
  if (readiness(state, robot).length)
    throw new GatewayError(
      'invalid',
      'Robot is unavailable: ' + readiness(state, robot).join('; '),
    );
  if (!resource.available) throw new GatewayError('invalid', 'Resource is out of service');
  if (
    !Number.isInteger(command.priority) ||
    command.priority < 1 ||
    command.priority > 5 ||
    !Number.isInteger(command.duration) ||
    command.duration < 1 ||
    command.duration > 600
  )
    throw new GatewayError('invalid', 'Priority must be 1–5 and duration 1–600 seconds');
  const active = robot.activeMissionId ? state.missions[robot.activeMissionId] : null,
    missionId = active && !['completed', 'cancelled'].includes(active.status) ? active.id : null;
  if (missionId) {
    const route = state.routes[active!.routeId];
    route.resourceIds = [...new Set([...(route.resourceIds ?? []), resource.id])];
    route.revision++;
  }
  request(state, resource.id, robot, missionId, command.priority, command.duration);
  return [robot, ...synchronizeResources(state).map((e) => e.robot)];
}
export function seedResources(state: DomainState) {
  const kinds: ResourceKind[] = [
    'elevator',
    'door',
    'narrow-corridor',
    'dock',
    'loading-bay',
    'inspection-station',
  ];
  for (const floor of Object.values(state.floors))
    kinds.forEach((kind, index) => {
      const id = 'RES-' + floor.id + '-' + (index + 1);
      state.resources[id] = {
        id,
        revision: 1,
        facilityId: floor.facilityId,
        floorId: floor.id,
        zoneId: floor.zoneIds[index],
        kind,
        name: kind.replaceAll('-', ' ') + ' ' + (index + 1),
        available: true,
        capacity: 1,
        corridorId: kind === 'narrow-corridor' ? floor.corridorIds[0] : null,
      };
    });
}
