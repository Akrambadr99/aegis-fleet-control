import { reserveMissionResources, releaseRobotResources } from './resources';
import type { DomainState, Robot, Versioned, Command } from './model';
import { shortestPath, type PathResult } from './navigation';
import { readiness } from './selectors';
import { robotCommitments } from './availability';
import { newPlan, newStep } from './planning';
import { recordPlanRevision } from './planHistory';
import { GatewayError } from '../gateway/requests';
export interface JobInput {
  title: string;
  facilityId: string;
  sourceZoneId: string;
  destinationZoneId: string;
  payloadKg: number;
  units: number;
  priority: number;
  deadlineTick: number;
  dependsOn: string[];
}
export interface WarehouseJob extends Versioned, JobInput {
  status: 'queued' | 'assigned' | 'in-progress' | 'partially-completed' | 'completed' | 'cancelled';
  completedUnits: number;
  assignedUnits: number;
  robotId: string | null;
  missionId: string | null;
  missionIds?: string[];
  custody: 'source' | 'robot' | 'destination';
  assignmentReason: string;
  pickupProgress: number;
}
export type JobCommand =
  | { type: 'job.save'; id: string; expectedRevision: number; input: JobInput }
  | {
      type: 'job.assign';
      id: string;
      expectedRevision: number;
      robotId?: string;
      expectedRobotRevision?: number;
      units: number;
      reason: string;
    }
  | { type: 'job.cancel'; id: string; expectedRevision: number; reason: string };
export function isJobCommand(command: Command): command is JobCommand {
  return command.type.startsWith('job.');
}
export interface RobotCandidate {
  robotId: string;
  robotRevision: number;
  reasons: string[];
  score: number;
  distance: number;
  duration: number;
  batteryRequired: number;
  pickupDistance: number;
  path: PathResult | null;
}
export function jobPath(state: DomainState, robot: Robot, job: JobInput) {
  const nodes = Object.values(state.navigationNodes);
  const origin = nodes
    .filter((n) => n.floorId === robot.floorId)
    .sort(
      (a, b) =>
        Math.hypot(a.position.x - robot.position.x, a.position.y - robot.position.y) -
          Math.hypot(b.position.x - robot.position.x, b.position.y - robot.position.y) ||
        a.id.localeCompare(b.id),
    )[0];
  const source = nodes.find((n) => n.zoneId === job.sourceZoneId),
    target = nodes.find((n) => n.zoneId === job.destinationZoneId);
  const pickup = origin && source ? shortestPath(state, origin.id, source.id) : null;
  const delivery = source && target ? shortestPath(state, source.id, target.id) : null;
  if (!pickup || !delivery) return null;
  return {
    path: {
      nodeIds: [...pickup.nodeIds, ...delivery.nodeIds.slice(1)],
      edgeIds: [...pickup.edgeIds, ...delivery.edgeIds],
      corridorIds: [...new Set([...pickup.corridorIds, ...delivery.corridorIds])],
      distance: pickup.distance + delivery.distance,
    },
    pickupDistance: pickup.distance,
  };
}
export function rankCandidates(state: DomainState, job: WarehouseJob): RobotCandidate[] {
  return Object.values(state.robots)
    .filter((r) => r.facilityId === job.facilityId)
    .map((robot) => {
      const reasons = [...readiness(state, robot), ...robotCommitments(state, robot)];
      if (
        !robot.capabilities.actions.includes('lift') ||
        robot.capabilities.payloadKg < job.payloadKg
      )
        reasons.push('Payload capability mismatch');
      if (job.dependsOn.some((id) => state.jobs[id]?.status !== 'completed'))
        reasons.push('Predecessor job incomplete');
      if (
        Object.values(state.resources).some(
          (r) => [job.sourceZoneId, job.destinationZoneId].includes(r.zoneId) && !r.available,
        )
      )
        reasons.push('Facility resource out of service');
      const route = jobPath(state, robot, job),
        distance = route?.path.distance ?? 0,
        duration = Math.ceil(distance / robot.capabilities.maxSpeed),
        batteryRequired = distance * 0.12;
      if (!route) reasons.push('Source or destination is unreachable');
      if (robot.battery < batteryRequired + 10)
        reasons.push('Insufficient delivery battery reserve');
      if (state.tick + duration > job.deadlineTick) reasons.push('Deadline cannot be met');
      const score = distance + (100 - robot.battery) * 2;
      return {
        robotId: robot.id,
        robotRevision: robot.revision,
        reasons,
        score,
        distance,
        duration,
        batteryRequired,
        pickupDistance: route?.pickupDistance ?? 0,
        path: route?.path ?? null,
      };
    })
    .sort(
      (a, b) =>
        Number(!!a.reasons.length) - Number(!!b.reasons.length) ||
        a.score - b.score ||
        a.robotId.localeCompare(b.robotId),
    );
}
function validateInput(state: DomainState, id: string, input: JobInput) {
  if (!input.title.trim() || !state.facilities[input.facilityId])
    throw new GatewayError('invalid', 'Job title and facility are required');
  if (
    !Number.isInteger(input.units) ||
    input.units < 1 ||
    !Number.isFinite(input.payloadKg) ||
    input.payloadKg <= 0 ||
    !Number.isInteger(input.priority) ||
    input.priority < 1 ||
    input.priority > 5 ||
    !Number.isInteger(input.deadlineTick) ||
    input.deadlineTick <= state.tick
  )
    throw new GatewayError('invalid', 'Check quantity, payload, priority and future deadline');
  for (const zoneId of [input.sourceZoneId, input.destinationZoneId])
    if (state.floors[state.zones[zoneId]?.floorId]?.facilityId !== input.facilityId)
      throw new GatewayError('invalid', 'Job stations must belong to the operating facility');
  if (input.sourceZoneId === input.destinationZoneId)
    throw new GatewayError('invalid', 'Source and destination must differ');
  if (new Set(input.dependsOn).size !== input.dependsOn.length)
    throw new GatewayError('invalid', 'Dependencies must be unique');
  const visit = (key: string, seen: Set<string>): boolean => {
    if (key === id || seen.has(key)) return true;
    const dep = state.jobs[key];
    if (!dep || dep.facilityId !== input.facilityId || dep.status === 'cancelled')
      throw new GatewayError('invalid', 'Dependency is unavailable in this facility');
    return dep.dependsOn.some((next) => visit(next, new Set([...seen, key])));
  };
  if (input.dependsOn.some((dep) => visit(dep, new Set())))
    throw new GatewayError('invalid', 'Job dependencies contain a cycle');
}
function releaseAssignment(state: DomainState, job: WarehouseJob) {
  if (job.custody === 'robot')
    throw new GatewayError(
      'invalid',
      'Payload is in robot custody; finish delivery before reassignment or cancellation',
    );
  if (!job.missionId || !job.robotId) return;
  const mission = state.missions[job.missionId],
    robot = state.robots[job.robotId];
  releaseRobotResources(state, robot.id, mission.id);
  mission.status = 'cancelled';
  mission.pauseReason = 'Job assignment released';
  mission.revision++;
  const route = state.routes[mission.routeId];
  route.reservationState = 'released';
  route.revision++;
  if (robot.activeMissionId === mission.id) {
    robot.activeMissionId = null;
    if (['running', 'paused'].includes(robot.status)) robot.status = 'idle';
    robot.revision++;
  }
}
export function applyJob(state: DomainState, command: JobCommand, actorId = 'scheduler'): Robot[] {
  const existing = state.jobs[command.id];
  if ((existing?.revision ?? 0) !== command.expectedRevision)
    throw new GatewayError('stale', 'Job changed; review the current assignment');
  if (command.type === 'job.save') {
    if (
      existing &&
      (!['queued', 'partially-completed'].includes(existing.status) ||
        existing.facilityId !== command.input.facilityId)
    )
      throw new GatewayError('invalid', 'Only unassigned jobs can be edited within their facility');
    validateInput(state, command.id, command.input);
    if (existing && command.input.units <= existing.completedUnits)
      throw new GatewayError('invalid', 'Quantity must include undelivered work');
    state.jobs[command.id] = {
      ...structuredClone(command.input),
      id: command.id,
      revision: command.expectedRevision + 1,
      status: existing?.status ?? 'queued',
      completedUnits: existing?.completedUnits ?? 0,
      assignedUnits: 0,
      robotId: null,
      missionId: null,
      missionIds: existing?.missionIds ?? [],
      custody: 'source',
      assignmentReason: '',
      pickupProgress: 0,
    };
    return [];
  }
  if (!existing) throw new GatewayError('missing', 'Job no longer exists');
  if (['completed', 'cancelled'].includes(existing.status))
    throw new GatewayError('invalid', 'Job is already closed');
  const affected: Robot[] = existing.robotId ? [state.robots[existing.robotId]] : [];
  if (command.type === 'job.cancel') {
    if (!command.reason.trim())
      throw new GatewayError('invalid', 'Cancellation reason is required');
    releaseAssignment(state, existing);
    existing.status = 'cancelled';
    existing.assignmentReason = command.reason;
    existing.robotId = null;
    existing.missionId = null;
    existing.assignedUnits = 0;
    existing.revision++;
    return affected;
  }
  if (
    !Number.isInteger(command.units) ||
    command.units < 1 ||
    command.units > existing.units - existing.completedUnits
  )
    throw new GatewayError('invalid', 'Assignment quantity exceeds remaining work');
  const candidates = rankCandidates(state, existing),
    candidate = command.robotId
      ? candidates.find((c) => c.robotId === command.robotId)
      : candidates.find((c) => !c.reasons.length);
  if (!candidate || candidate.reasons.length)
    throw new GatewayError('invalid', candidate?.reasons.join('; ') || 'No eligible robot');
  if (command.robotId && command.expectedRobotRevision !== candidate.robotRevision)
    throw new GatewayError('stale', 'Robot state changed; review candidate ranking');
  if (command.robotId && !command.reason.trim())
    throw new GatewayError('invalid', 'Manual assignment reasoning is required');
  releaseAssignment(state, existing);
  const robot = state.robots[candidate.robotId],
    path = candidate.path!,
    missionId = 'M-' + existing.id + '-' + (existing.revision + 1),
    routeId = 'RT-' + missionId,
    planId = 'PLAN-' + missionId;
  const plan = newPlan(planId, existing.facilityId, robot.id);
  plan.title = existing.title;
  plan.revision = 1;
  plan.steps = [
    { ...newStep('source'), zoneId: existing.sourceZoneId },
    { ...newStep('pickup', 'pickup'), payloadKg: existing.payloadKg, dependsOn: ['source'] },
    { ...newStep('destination'), zoneId: existing.destinationZoneId, dependsOn: ['pickup'] },
    { ...newStep('dropoff', 'dropoff'), payloadKg: existing.payloadKg, dependsOn: ['destination'] },
  ];
  recordPlanRevision(state, plan, actorId);
  state.routes[routeId] = {
    id: routeId,
    revision: 1,
    robotId: robot.id,
    facilityId: robot.facilityId,
    nodeIds: path.nodeIds,
    edgeIds: path.edgeIds,
    corridorIds: path.corridorIds,
    origin: { ...robot.position },
    topologyRevision: state.facilities[robot.facilityId].topologyRevision,
    state: 'valid',
    reservationState: 'active',
  };
  state.missions[missionId] = {
    id: missionId,
    revision: 1,
    robotId: robot.id,
    facilityId: robot.facilityId,
    destinationId: existing.destinationZoneId,
    routeId,
    status: 'running',
    priority: existing.priority,
    progress: 0,
    pauseReason: null,
    requirements: { payloadKg: existing.payloadKg, actions: ['navigate', 'lift'] },
    jobId: existing.id,
    planId,
  };
  robot.activeMissionId = missionId;
  robot.status = 'running';
  robot.revision++;
  existing.robotId = robot.id;
  existing.missionId = missionId;
  existing.missionIds = [...(existing.missionIds ?? []), missionId];
  existing.assignedUnits = command.units;
  existing.status = 'assigned';
  existing.custody = 'source';
  existing.pickupProgress = candidate.distance
    ? (candidate.pickupDistance / candidate.distance) * 100
    : 0;
  existing.assignmentReason = command.robotId
    ? command.reason
    : 'Automatic ranking: shortest eligible delivery with battery reserve';
  existing.revision++;
  const resourceIds = Object.values(state.resources)
    .filter((r) => [existing.sourceZoneId, existing.destinationZoneId].includes(r.zoneId))
    .map((r) => r.id);
  reserveMissionResources(state, robot, missionId, resourceIds, existing.priority);
  return [...affected, robot];
}
export function synchronizeJobs(state: DomainState) {
  const changes: { robot: Robot; job: WarehouseJob; event: string }[] = [];
  for (const job of Object.values(state.jobs)) {
    if (!job.missionId || !job.robotId || !['assigned', 'in-progress'].includes(job.status))
      continue;
    const mission = state.missions[job.missionId],
      robot = state.robots[job.robotId];
    if (
      job.custody === 'source' &&
      mission.progress >= job.pickupProgress &&
      mission.progress > 0
    ) {
      job.custody = 'robot';
      job.status = 'in-progress';
      job.revision++;
      changes.push({ robot, job, event: 'job.picked-up' });
    }
    if (mission.status === 'completed') {
      job.completedUnits += job.assignedUnits;
      job.assignedUnits = 0;
      job.status = job.completedUnits === job.units ? 'completed' : 'partially-completed';
      job.custody = job.status === 'completed' ? 'destination' : 'source';
      job.robotId = null;
      job.missionId = null;
      job.revision++;
      changes.push({ robot, job, event: 'job.delivered' });
    }
  }
  return changes;
}
export function seedJobs(state: DomainState) {
  Object.values(state.facilities).forEach((facility, index) => {
    const zones = state.floors[facility.floorIds[0]].zoneIds;
    for (let n = 0; n < 2; n++) {
      const id = 'JOB-' + String(index * 2 + n + 1).padStart(3, '0');
      state.jobs[id] = {
        id,
        revision: 1,
        title: n ? 'Inspection station replenishment' : 'Dock 04 pallet transfer',
        facilityId: facility.id,
        sourceZoneId: zones[1],
        destinationZoneId: zones[4],
        payloadKg: 60,
        units: 4,
        priority: n ? 2 : 4,
        deadlineTick: 2000 + index * 300,
        dependsOn: n ? ['JOB-' + String(index * 2 + 1).padStart(3, '0')] : [],
        status: 'queued',
        completedUnits: 0,
        assignedUnits: 0,
        robotId: null,
        missionId: null,
        custody: 'source',
        assignmentReason: '',
        pickupProgress: 0,
      };
    }
  });
}
