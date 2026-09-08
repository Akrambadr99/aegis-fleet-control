import type { DomainState } from './model';
import type { MissionPlan } from './planning';
import { GatewayError } from '../gateway/requests';

/** Every producer of a mission plan records the same immutable revision contract. */
export function recordPlanRevision(state: DomainState, plan: MissionPlan, actorId: string) {
  const id = JSON.stringify([plan.id, plan.revision]);
  if (state.planRevisions[id]) throw new GatewayError('stale', 'Mission revision already recorded');
  const saved = {
    ...structuredClone(plan),
    ownerId: state.plans[plan.id]?.ownerId ?? actorId,
  };
  state.plans[plan.id] = saved;
  state.planRevisions[id] = {
    id,
    revision: saved.revision,
    planId: saved.id,
    savedBy: actorId,
    savedAtTick: state.tick,
    plan: structuredClone(saved),
  };
}
