import type { DomainState, Versioned } from './model';
import { shortestPath } from './navigation';
import { readiness } from './selectors';
export const stepKinds = [
  'navigate',
  'pickup',
  'dropoff',
  'wait',
  'inspect',
  'charge',
  'resource',
] as const;
export type StepKind = (typeof stepKinds)[number];
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
  const ids = new Set(plan.steps.map((s) => s.id));
  if (ids.size !== plan.steps.length || ids.has(''))
    issue('Step identifiers must be unique and nonempty');
  const pending = [...plan.steps];
  const durations = new Map<string, number>();
  let cursor = robot
    ? state.routes[state.missions[robot.activeMissionId ?? '']?.routeId]?.nodeIds[0]
    : undefined;
  cursor ??= Object.values(state.navigationNodes).find((n) => n.floorId === robot?.floorId)?.id;
  for (const step of plan.steps) {
    if (!stepKinds.includes(step.kind)) issue('Unsupported step kind', step.id);
    if (!['always', 'battery-low', 'fault-present'].includes(step.condition))
      issue('Unsupported branch condition', step.id);
    if (new Set(step.dependsOn).size !== step.dependsOn.length)
      issue('Dependency is repeated', step.id);
    if (step.dependsOn.some((id) => !ids.has(id)))
      issue('Dependency references a missing step', step.id);
  }
  while (pending.length) {
    const index = pending.findIndex((s) => s.dependsOn.every((id) => result.order.includes(id)));
    if (index < 0) {
      issue('Dependencies contain a cycle or missing reference');
      break;
    }
    const step = pending.splice(index, 1)[0];
    result.order.push(step.id);
    let duration = 0;
    if (step.kind === 'navigate') {
      const zone = state.zones[step.zoneId];
      const target = Object.values(state.navigationNodes).find((n) => n.zoneId === step.zoneId);
      if (!zone || state.floors[zone.floorId]?.facilityId !== plan.facilityId)
        issue('Destination must belong to this facility', step.id);
      else {
        const path = cursor && target ? shortestPath(state, cursor, target.id) : null;
        if (!path) issue('Destination is unreachable through the current topology', step.id);
        else {
          result.distance += path.distance;
          duration = path.distance / (robot?.capabilities.maxSpeed || 1.2);
          cursor = target!.id;
        }
      }
    } else if (step.kind === 'pickup' || step.kind === 'dropoff') {
      if (!Number.isFinite(step.payloadKg) || step.payloadKg <= 0)
        issue('Payload must be a positive weight', step.id);
      if (
        robot &&
        (!robot.capabilities.actions.includes('lift') ||
          step.payloadKg > robot.capabilities.payloadKg)
      )
        issue('Robot cannot handle this payload', step.id);
      duration = 15;
    } else if (step.kind === 'inspect') {
      if (robot && !robot.capabilities.actions.includes('inspect'))
        issue('Robot cannot inspect', step.id);
      duration = step.seconds;
    } else if (step.kind === 'charge') {
      const charger = state.chargers[step.chargerId];
      if (!charger || charger.facilityId !== plan.facilityId || !charger.available)
        issue('Choose an available charger in this facility', step.id);
      duration = step.seconds;
    } else if (step.kind === 'resource') {
      const resource = state.resources[step.resourceId];
      if (!resource || resource.facilityId !== plan.facilityId || !resource.available)
        issue('Choose an available resource in this facility', step.id);
      duration = step.seconds;
    } else duration = step.seconds;
    if (!Number.isFinite(duration) || duration < 0) {
      issue('Duration must be a nonnegative number', step.id);
      duration = 0;
    }
    const start = Math.max(0, ...step.dependsOn.map((id) => durations.get(id) ?? 0));
    durations.set(step.id, start + duration);
  }
  result.durationSeconds = Math.ceil(Math.max(0, ...durations.values()));
  result.batteryRequired = Number((result.distance * 0.12).toFixed(2));
  if (robot && robot.battery < result.batteryRequired + 10)
    issue('Insufficient battery reserve for planned travel');
  return result;
}
