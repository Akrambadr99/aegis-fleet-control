import { supportsMissionAction, chargerCapabilities, resourceCapabilities } from './capabilities';
import type { DomainState, Versioned } from './model';
import { shortestPath, nearestNavigationNode } from './navigation';
import { readiness } from './selectors';
import { robotCommitments } from './availability';
import { canReachFacilityTarget, resourceDispatchIssues } from './facilityFeasibility';
import { estimateJourney, motionProfile } from './motion';
export const stepKinds = [
  'navigate',
  'pickup',
  'dropoff',
  'wait',
  'inspect',
  'charge',
  'resource',
  'dock',
  'open-door',
  'call-elevator',
  'conditional-branch',
  'parallel-branch',
] as const;
export type StepKind = (typeof stepKinds)[number];
export const resourceStepKinds = {
  resource: null,
  dock: 'dock',
  'open-door': 'door',
  'call-elevator': 'elevator',
} as const;
export function isResourceStep(kind: StepKind): kind is keyof typeof resourceStepKinds {
  return Object.hasOwn(resourceStepKinds, kind);
}
export interface MissionStep {
  id: string;
  kind: StepKind;
  label: string;
  dependsOn: string[];
  condition: 'always' | 'battery-low' | 'fault-present';
  zoneId: string;
  seconds: number;
  payloadKg: number;
  chargerId: string;
  resourceId: string;
}
export interface MissionPlan extends Versioned {
  ownerId?: string;
  templateSource?: { id: string; revision: number };
  title: string;
  facilityId: string;
  robotId: string;
  steps: MissionStep[];
}
export interface MissionPlanRevision extends Versioned {
  planId: string;
  savedBy: string;
  savedAtTick: number;
  plan: MissionPlan;
}
export interface PlanIssue {
  stepId: string | null;
  message: string;
}
export interface PlanValidation {
  issues: PlanIssue[];
  dispatchIssues: string[];
  distance: number;
  batteryRequired: number;
  durationSeconds: number;
  order: string[];
  stateRevision: number;
}
export function newStep(id: string, kind: StepKind = 'navigate'): MissionStep {
  return {
    id,
    kind,
    label: '',
    dependsOn: [],
    condition: 'always',
    zoneId: '',
    seconds: 10,
    payloadKg: 20,
    chargerId: '',
    resourceId: '',
  };
}
export function newPlan(id: string, facilityId: string, robotId: string): MissionPlan {
  return { id, revision: 0, title: 'Dock transfer', facilityId, robotId, steps: [] };
}
export function validatePlan(state: DomainState, plan: MissionPlan): PlanValidation {
  const result: PlanValidation = {
    issues: [],
    dispatchIssues: [],
    distance: 0,
    batteryRequired: 0,
    durationSeconds: 0,
    order: [],
    stateRevision: state.revision,
  };
  const issue = (message: string, stepId: string | null = null) =>
    result.issues.push({ stepId, message });
  const robot = state.robots[plan.robotId];
  if (!plan.title.trim()) issue('Mission title is required');
  if (!state.facilities[plan.facilityId]) issue('Facility no longer exists');
  if (!robot || robot.facilityId !== plan.facilityId) issue('Choose a robot in this facility');
  if (!plan.steps.length) issue('Add at least one mission step');
  if (plan.steps.length > 100) issue('A mission supports at most 100 steps');
  if (robot) readiness(state, robot).forEach((reason) => issue(reason));
  if (robot) result.dispatchIssues = robotCommitments(state, robot);
  const ids = new Set(plan.steps.map((s) => s.id));
  if (ids.size !== plan.steps.length || ids.has(''))
    issue('Step identifiers must be unique and nonempty');
  const pending = [...plan.steps];
  const durations = new Map<string, number>();
  const payloads = new Map<string, number>();
  let cursor = robot ? nearestNavigationNode(state, robot.floorId, robot.position)?.id : undefined;
  for (const step of plan.steps) {
    if (!stepKinds.includes(step.kind)) issue('Unsupported step kind', step.id);
    if (!['always', 'battery-low', 'fault-present'].includes(step.condition))
      issue('Unsupported branch condition', step.id);
    if (new Set(step.dependsOn).size !== step.dependsOn.length)
      issue('Dependency is repeated', step.id);
    if (step.dependsOn.some((id) => !ids.has(id)))
      issue('Dependency references a missing step', step.id);
    const children = plan.steps.filter((candidate) => candidate.dependsOn.includes(step.id));
    if (step.kind === 'conditional-branch') {
      if (step.condition === 'always') issue('Choose a condition for this branch', step.id);
      if (!children.length) issue('A conditional branch needs a dependent step', step.id);
    }
    if (step.kind === 'parallel-branch' && children.length < 2)
      issue('A parallel branch needs at least two dependent steps', step.id);
  }
  while (pending.length) {
    const index = pending.findIndex((s) => s.dependsOn.every((id) => result.order.includes(id)));
    if (index < 0) {
      issue('Dependencies contain a cycle or missing reference');
      break;
    }
    const step = pending.splice(index, 1)[0];
    result.order.push(step.id);
    let payloadKg = Math.max(0, ...step.dependsOn.map((id) => payloads.get(id) ?? 0));
    let duration = 0;
    if (step.kind === 'conditional-branch' || step.kind === 'parallel-branch') {
      // Control nodes add no work; downstream dependencies determine the critical path.
      duration = 0;
    } else if (step.kind === 'navigate') {
      if (robot && !supportsMissionAction(robot, 'navigate'))
        issue('Robot cannot navigate', step.id);
      const zone = state.zones[step.zoneId];
      const target = Object.values(state.navigationNodes).find((n) => n.zoneId === step.zoneId);
      if (!zone || state.floors[zone.floorId]?.facilityId !== plan.facilityId)
        issue('Destination must belong to this facility', step.id);
      else {
        const path = cursor && target ? shortestPath(state, cursor, target.id) : null;
        if (!path) issue('Destination is unreachable through the current topology', step.id);
        else {
          result.distance += path.distance;
          if (robot) {
            const estimate = estimateJourney(robot, [{ distance: path.distance, payloadKg }]);
            duration = estimate.seconds;
            result.batteryRequired += estimate.batteryRequired;
          }
          cursor = target!.id;
        }
      }
    } else if (step.kind === 'pickup' || step.kind === 'dropoff') {
      if (!Number.isFinite(step.payloadKg) || step.payloadKg <= 0)
        issue('Payload must be a positive weight', step.id);
      if (robot && !supportsMissionAction(robot, step.kind, step.payloadKg))
        issue('Robot cannot handle this payload', step.id);
      duration = 15;
      payloadKg =
        step.kind === 'pickup' && Number.isFinite(step.payloadKg) && step.payloadKg > 0
          ? step.payloadKg
          : 0;
    } else if (step.kind === 'inspect') {
      if (robot && !supportsMissionAction(robot, 'inspect')) issue('Robot cannot inspect', step.id);
      duration = step.seconds;
    } else if (step.kind === 'charge') {
      const charger = state.chargers[step.chargerId];
      if (
        !charger ||
        charger.facilityId !== plan.facilityId ||
        !chargerCapabilities(charger).charge
      )
        issue('Choose an available charger in this facility', step.id);
      else {
        if (!canReachFacilityTarget(state, cursor, charger))
          issue('Charger floor is unreachable through the current topology', step.id);
        if (
          Object.values(state.reservations).some(
            (reservation) =>
              reservation.chargerId === charger.id &&
              reservation.state === 'charging' &&
              reservation.robotId !== plan.robotId,
          )
        )
          result.dispatchIssues.push('Charger ' + charger.id + ' is occupied');
      }
      if (!Number.isFinite(step.seconds) || step.seconds <= 0)
        issue('Charging duration must be positive', step.id);
      duration = step.seconds;
    } else if (isResourceStep(step.kind)) {
      const resource = state.resources[step.resourceId];
      if (
        !resource ||
        resource.facilityId !== plan.facilityId ||
        !resourceCapabilities(resource).available
      )
        issue('Choose an available resource in this facility', step.id);
      else if (resourceStepKinds[step.kind] && resource.kind !== resourceStepKinds[step.kind])
        issue('This action requires a ' + resourceStepKinds[step.kind] + ' resource', step.id);
      else {
        if (!canReachFacilityTarget(state, cursor, resource))
          issue('Resource is unreachable through the current topology', step.id);
        result.dispatchIssues.push(...resourceDispatchIssues(state, resource.id, plan.robotId));
      }
      duration = step.seconds;
    } else duration = step.seconds;
    if (!Number.isFinite(duration) || duration < 0) {
      issue('Duration must be a nonnegative number', step.id);
      duration = 0;
    }
    const start = Math.max(0, ...step.dependsOn.map((id) => durations.get(id) ?? 0));
    durations.set(step.id, start + duration);
    payloads.set(step.id, payloadKg);
  }
  result.durationSeconds = Math.ceil(Math.max(0, ...durations.values()));
  result.batteryRequired = Number(result.batteryRequired.toFixed(2));
  if (robot && robot.battery < result.batteryRequired + motionProfile(robot).reservePercent)
    issue('Insufficient battery reserve for planned travel');
  result.dispatchIssues = [...new Set(result.dispatchIssues)];
  return result;
}
