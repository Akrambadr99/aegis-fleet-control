import { supportsMissionAction, supportsRobotAction, type RobotAction } from './capabilities';
import { jobKinds, jobProfiles, jobActions, jobSteps, type JobKind } from './jobKinds';
import { reserveMissionResources, releaseRobotResources } from './resources';
import type { DomainState, Robot, Versioned, Command } from './model';
import { shortestPath, type PathResult } from './navigation';
import { readiness } from './selectors';
import { robotCommitments } from './availability';
import { newPlan } from './planning';
import { recordPlanRevision } from './planHistory';
import { DomainError as GatewayError } from './errors';
import { assertDispatchOwnership, type JobDispatchLock } from './jobLocks';
export interface JobInput {
  kind?: JobKind;
  requiredActions?: RobotAction[];
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
  dispatchLock?: JobDispatchLock;
  groupId?: string;
  attempts?: JobAttempt[];
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
export interface JobAttempt {
  missionId: string;
  robotId: string;
  units: number;
  assignedAt: number;
  assignedBy: string;
  reason: string;
  outcome: 'active' | 'released' | 'completed';
  endedAt?: number;
  endedBy?: string;
  endReason?: string;
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
      onlyUnassigned?: boolean;
      reason: string;
    }
  | { type: 'job.cancel'; id: string; expectedRevision: number; reason: string }
  | { type: 'job.release'; id: string; expectedRevision: number; reason: string };
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
function jobDispatchIssues(state: DomainState, job: WarehouseJob) {
  const issues: string[] = [];
  if (job.groupId && state.jobGroups[job.groupId]?.status !== 'ready')
    issues.push('Dispatch group is not released');
  if (job.dependsOn.some((id) => state.jobs[id]?.status !== 'completed'))
    issues.push('Predecessor job incomplete');
  if (
    Object.values(state.resources).some(
      (resource) =>
        [job.sourceZoneId, job.destinationZoneId].includes(resource.zoneId) && !resource.available,
    )
  )
    issues.push('Facility resource out of service');
  return issues;
}
export function rankCandidates(state: DomainState, job: WarehouseJob): RobotCandidate[] {
  return Object.values(state.robots)
    .filter((r) => r.facilityId === job.facilityId)
    .map((robot) => {
      const reasons = [
        ...readiness(state, robot),
        ...robotCommitments(state, robot),
        ...jobDispatchIssues(state, job),
      ];
      if (
        jobProfiles[job.kind ?? 'transport'].cargo &&
        !supportsMissionAction(robot, 'pickup', job.payloadKg)
      )
        reasons.push('Payload capability mismatch');
      for (const action of jobActions(job))
        if (!supportsRobotAction(robot, action)) reasons.push('Required capability: ' + action);
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
  if (!jobKinds.includes(input.kind ?? 'transport'))
    throw new GatewayError('invalid', 'Choose a supported job kind');
  if (
    input.requiredActions &&
    (new Set(input.requiredActions).size !== input.requiredActions.length ||
      input.requiredActions.some((action) => !['navigate', 'lift', 'inspect'].includes(action)))
  )
    throw new GatewayError('invalid', 'Required capabilities must be supported and unique');
  const cargo = jobProfiles[input.kind ?? 'transport'].cargo;
  if (!input.title.trim() || !state.facilities[input.facilityId])
    throw new GatewayError('invalid', 'Job title and facility are required');
  if (
    !Number.isInteger(input.units) ||
    input.units < 1 ||
    !Number.isFinite(input.payloadKg) ||
    (cargo ? input.payloadKg <= 0 : input.payloadKg !== 0) ||
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
function releaseAssignment(state: DomainState, job: WarehouseJob, actorId: string, reason: string) {
  if (job.custody === 'robot')
    throw new GatewayError(
      'invalid',
      'Payload is in robot custody; finish delivery before reassignment or cancellation',
    );
  if (!job.missionId || !job.robotId) return;
  const attempt = job.attempts?.find((entry) => entry.missionId === job.missionId);
  if (attempt)
    Object.assign(attempt, {
      outcome: 'released',
      endedAt: state.tick,
      endedBy: actorId,
      endReason: reason,
    });
  const mission = state.missions[job.missionId],
    robot = state.robots[job.robotId];
  releaseRobotResources(state, robot.id, mission.id);
  mission.status = 'cancelled';
  mission.pauseReason = 'Job assignment released: ' + reason;
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
  if (existing) assertDispatchOwnership(existing, actorId, state.tick);
  if (command.type === 'job.save') {
    if (
      existing &&
      (!['queued', 'partially-completed'].includes(existing.status) ||
        existing.facilityId !== command.input.facilityId)
    )
      throw new GatewayError('invalid', 'Only unassigned jobs can be edited within their facility');
    validateInput(state, command.id, command.input);
    if (
      existing &&
      existing.completedUnits > 0 &&
      ((existing.kind ?? 'transport') !== (command.input.kind ?? 'transport') ||
        existing.sourceZoneId !== command.input.sourceZoneId ||
        existing.destinationZoneId !== command.input.destinationZoneId ||
        existing.payloadKg !== command.input.payloadKg ||
        [...jobActions(existing)].sort().join() !== [...jobActions(command.input)].sort().join())
    )
      throw new GatewayError(
        'invalid',
        'Delivered work fixes job kind, stations, payload and capabilities; create a new job',
      );
    if (existing && command.input.units <= existing.completedUnits)
      throw new GatewayError('invalid', 'Quantity must include undelivered work');
    state.jobs[command.id] = {
      ...structuredClone(command.input),
      kind: command.input.kind ?? 'transport',
      requiredActions: [...(command.input.requiredActions ?? [])],
      id: command.id,
      revision: command.expectedRevision + 1,
      status: existing?.status ?? 'queued',
      completedUnits: existing?.completedUnits ?? 0,
      assignedUnits: 0,
      robotId: null,
      missionId: null,
      missionIds: existing?.missionIds ?? [],
      attempts: existing?.attempts ?? [],
      groupId: existing?.groupId,
      dispatchLock: existing?.dispatchLock,
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
  if (command.type === 'job.cancel' || command.type === 'job.release') {
    if (!command.reason.trim())
      throw new GatewayError('invalid', 'Release or cancellation reason is required');
    if (command.type === 'job.release' && !existing.missionId)
      throw new GatewayError('invalid', 'Job has no assignment to release');
    releaseAssignment(state, existing, actorId, command.reason);
    existing.status =
      command.type === 'job.cancel'
        ? 'cancelled'
        : existing.completedUnits
          ? 'partially-completed'
          : 'queued';
    existing.assignmentReason = command.reason;
    existing.robotId = null;
    existing.missionId = null;
    existing.assignedUnits = 0;
    if (command.type === 'job.cancel' && existing.dispatchLock)
      existing.dispatchLock.state = 'released';
    existing.revision++;
    return affected;
  }
  if (
    !Number.isInteger(command.units) ||
    command.units < 1 ||
    command.units > existing.units - existing.completedUnits
  )
    throw new GatewayError('invalid', 'Assignment quantity exceeds remaining work');
  if (command.onlyUnassigned && existing.missionId)
    throw new GatewayError(
      'invalid',
      'Job already has an assignment; release it before batch dispatch',
    );
  const blockers = jobDispatchIssues(state, existing);
  if (blockers.length) throw new GatewayError('invalid', blockers.join('; '), 'scheduling');
  const candidates = rankCandidates(state, existing),
    candidate = command.robotId
      ? candidates.find((c) => c.robotId === command.robotId)
      : candidates.find((c) => !c.reasons.length);
  if (!candidate || candidate.reasons.length)
    throw new GatewayError(
      'invalid',
      candidate?.reasons.join('; ') || 'No eligible robot',
      'scheduling',
    );
  if (command.robotId && command.expectedRobotRevision !== candidate.robotRevision)
    throw new GatewayError('stale', 'Robot state changed; review candidate ranking');
  if (command.robotId && !command.reason.trim())
    throw new GatewayError('invalid', 'Manual assignment reasoning is required');
  releaseAssignment(state, existing, actorId, command.reason || 'Automatic reassignment');
  const robot = state.robots[candidate.robotId],
    path = candidate.path!,
    missionId = 'M-' + existing.id + '-' + (existing.revision + 1),
    routeId = 'RT-' + missionId,
    planId = 'PLAN-' + missionId;
  const plan = newPlan(planId, existing.facilityId, robot.id);
  plan.title = existing.title;
  plan.revision = 1;
  plan.steps = jobSteps(existing);
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
    requirements: { payloadKg: existing.payloadKg, actions: jobActions(existing) },
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
  existing.attempts = [
    ...(existing.attempts ?? []),
    {
      missionId,
      robotId: robot.id,
      units: command.units,
      assignedAt: state.tick,
      assignedBy: actorId,
      reason: existing.assignmentReason,
      outcome: 'active',
    },
  ];
  existing.revision++;
  const resourceIds = Object.values(state.resources)
    .filter((r) => [existing.sourceZoneId, existing.destinationZoneId].includes(r.zoneId))
    .map((r) => r.id);
  reserveMissionResources(state, robot, missionId, resourceIds, existing.priority);
  return [...affected, robot];
}
export function synchronizeJobs(state: DomainState) {
  const changes: {
    robot: Robot;
    job: WarehouseJob;
    event: 'job.picked-up' | 'job.delivered' | 'job.started' | 'job.completed';
  }[] = [];
  for (const job of Object.values(state.jobs)) {
    if (!job.missionId || !job.robotId || !['assigned', 'in-progress'].includes(job.status))
      continue;
    const mission = state.missions[job.missionId],
      robot = state.robots[job.robotId];
    if (
      job.status === 'assigned' &&
      mission.progress >= job.pickupProgress &&
      mission.progress > 0
    ) {
      const cargo = jobProfiles[job.kind ?? 'transport'].cargo;
      job.custody = cargo ? 'robot' : 'source';
      job.status = 'in-progress';
      job.revision++;
      changes.push({ robot, job, event: cargo ? 'job.picked-up' : 'job.started' });
    }
    if (mission.status === 'completed') {
      const attempt = job.attempts?.find((entry) => entry.missionId === mission.id);
      if (attempt)
        Object.assign(attempt, {
          outcome: 'completed',
          endedAt: state.tick,
          endedBy: 'clock',
          endReason: 'Mission completed',
        });
      job.completedUnits += job.assignedUnits;
      job.assignedUnits = 0;
      job.status = job.completedUnits === job.units ? 'completed' : 'partially-completed';
      if (job.status === 'completed' && job.dispatchLock) job.dispatchLock.state = 'released';
      job.custody = job.status === 'completed' ? 'destination' : 'source';
      job.robotId = null;
      job.missionId = null;
      job.revision++;
      changes.push({
        robot,
        job,
        event: jobProfiles[job.kind ?? 'transport'].cargo ? 'job.delivered' : 'job.completed',
      });
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
