import type { Actor, Command, DomainState } from './model';
import { canExecute } from './selectors';
export function commandFacility(state: DomainState, command: Command): string | undefined {
  switch (command.type) {
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
  const facilityId = commandFacility(state, command);
  if (!canExecute(actor.role, command.type)) return 'Your role cannot execute this command';
  if (!facilityId) return 'Entity no longer exists';
  return facilityPermission(actor, facilityId, command.type);
}
