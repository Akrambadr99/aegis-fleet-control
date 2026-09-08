import type { Actor, Command, DomainState } from './model';
import type { ErrorCode } from './errors';
import { DomainError } from './errors';

const administrator = ['administrator'] as const;
const operator = ['operator', 'fleet-manager', 'administrator'] as const;
const fleetManager = ['fleet-manager', 'administrator'] as const;
const facilityManager = ['facility-manager', 'administrator'] as const;

export const commandRoles = {
  'automation.save': fleetManager,
  'automation.toggle': fleetManager,
  'charger.set': facilityManager,
  'charging.request': operator,
  'control.acquire': operator,
  'control.move': operator,
  'control.release': operator,
  'control.renew': operator,
  'control.takeover': administrator,
  'corridor.set': facilityManager,
  'dispatch-lock.acquire': fleetManager,
  'dispatch-lock.release': fleetManager,
  'dispatch-lock.renew': fleetManager,
  'dispatch-lock.takeover': administrator,
  'fault.acknowledge': operator,
  'fault.escalate': operator,
  'job.assign': fleetManager,
  'job.cancel': fleetManager,
  'job.release': fleetManager,
  'job.save': fleetManager,
  'job-group.create': fleetManager,
  'job-group.set': fleetManager,
  'maintenance.complete': fleetManager,
  'maintenance.start': fleetManager,
  'maintenance.verify': fleetManager,
  'plan.save': fleetManager,
  'resource.release': operator,
  'resource.request': operator,
  'resource.set': facilityManager,
  'robot.connection': administrator,
  'robot.pause': operator,
  'robot.reroute': operator,
  'robot.resume': operator,
  'robot.stop': operator,
  'template.create': fleetManager,
} as const satisfies Record<Command['type'], readonly Actor['role'][]>;

export function canExecute(role: Actor['role'], type: Command['type']) {
  return (commandRoles[type] as readonly Actor['role'][]).includes(role);
}

export type AuthorizationDecision =
  | { allowed: true; facilityId: string }
  | {
      allowed: false;
      code: Extract<ErrorCode, 'forbidden' | 'missing'>;
      reason: string;
    };

const roles: readonly Actor['role'][] = [
  'viewer',
  'operator',
  'fleet-manager',
  'facility-manager',
  'administrator',
];

function actorDenial(actor: Actor): string | null {
  if (!actor || typeof actor.id !== 'string' || !actor.id.trim() || !roles.includes(actor.role))
    return 'A valid operator identity is required';
  if (
    actor.facilityIds !== undefined &&
    (!Array.isArray(actor.facilityIds) ||
      actor.facilityIds.some((id) => typeof id !== 'string' || !id.trim()) ||
      new Set(actor.facilityIds).size !== actor.facilityIds.length)
  )
    return 'Operator facility grants are invalid';
  return null;
}
export function commandFacility(state: DomainState, command: Command): string | undefined {
  switch (command.type) {
    case 'job-group.create':
      return state.jobGroups[command.id]?.facilityId ?? command.facilityId;
    case 'job-group.set':
      return state.jobGroups[command.id]?.facilityId;
    case 'template.create':
      return state.plans[command.sourcePlanId]?.facilityId;
    case 'automation.save':
      return state.automationRules[command.id]?.facilityId ?? command.input.facilityId;
    case 'automation.toggle':
      return state.automationRules[command.id]?.facilityId;
    case 'resource.set':
    case 'resource.request':
      return state.resources[command.id]?.facilityId;
    case 'resource.release': {
      const lease = state.resourceReservations[command.id];
      return lease ? state.resources[lease.resourceId]?.facilityId : undefined;
    }
    case 'job.save':
      return state.jobs[command.id]?.facilityId ?? command.input.facilityId;
    case 'job.assign':
    case 'dispatch-lock.acquire':
    case 'dispatch-lock.renew':
    case 'dispatch-lock.release':
    case 'dispatch-lock.takeover':
    case 'job.release':
    case 'job.cancel':
      return state.jobs[command.id]?.facilityId;
    case 'plan.save':
      return state.plans[command.id]?.facilityId ?? command.plan.facilityId;
    case 'maintenance.start':
    case 'maintenance.verify':
    case 'maintenance.complete': {
      const order = state.maintenance[command.id];
      return order ? state.robots[order.robotId]?.facilityId : undefined;
    }
    case 'corridor.set': {
      const corridor = state.corridors[command.id];
      return corridor ? state.floors[corridor.floorId]?.facilityId : undefined;
    }
    case 'charger.set':
      return state.chargers[command.id]?.facilityId;
    case 'fault.acknowledge': {
      const fault = state.faults[command.id];
      return fault ? state.robots[fault.robotId]?.facilityId : undefined;
    }
    default:
      return state.robots[command.id]?.facilityId;
  }
}
export function facilityPermission(
  actor: Actor,
  facilityId: string,
  type: Command['type'],
): string | null {
  const invalidActor = actorDenial(actor);
  if (invalidActor) return invalidActor;
  if (!canExecute(actor.role, type)) return 'Your role cannot execute this command';
  if (actor.facilityIds && !actor.facilityIds.includes(facilityId))
    return 'This facility is outside your control scope';
  return null;
}
export function commandPermission(
  state: DomainState,
  actor: Actor,
  command: Command,
): string | null {
  const decision = authorizeCommand(state, actor, command);
  return decision.allowed ? null : decision.reason;
}

export function authorizeCommand(
  state: DomainState,
  actor: Actor,
  command: Command,
): AuthorizationDecision {
  const invalidActor = actorDenial(actor);
  if (invalidActor) return { allowed: false, code: 'forbidden', reason: invalidActor };
  // Resolve entities only after role eligibility so denial does not reveal their existence.
  if (!canExecute(actor.role, command.type))
    return { allowed: false, code: 'forbidden', reason: 'Your role cannot execute this command' };
  const facilityId = commandFacility(state, command);
  if (!facilityId) return { allowed: false, code: 'missing', reason: 'Entity no longer exists' };
  if (actor.facilityIds && !actor.facilityIds.includes(facilityId))
    return {
      allowed: false,
      code: 'forbidden',
      reason: 'This facility is outside your control scope',
    };
  return { allowed: true, facilityId };
}

export function assertCommandAuthorized(state: DomainState, actor: Actor, command: Command) {
  const decision = authorizeCommand(state, actor, command);
  if (!decision.allowed)
    throw new DomainError(
      decision.code,
      decision.reason,
      decision.code === 'forbidden' ? 'permission' : undefined,
    );
}
