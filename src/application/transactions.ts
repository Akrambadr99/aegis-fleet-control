import type { Actor, Command, DomainState } from '../domain/model';
import { applyCommand } from '../domain/transactions';
import { assertInvariants } from '../domain/invariants';
import { processAutomation } from './automationEngine';
export interface OperationContext {
  operationId: string;
  correlationId: string;
}
/** One candidate state, including automation consequences; callers publish only on success. */
export function executeTransaction(
  state: DomainState,
  actor: Actor,
  command: Command,
  context: OperationContext,
) {
  const next = structuredClone(state);
  const start = next.activity.length;
  applyCommand(next, actor, command);
  for (const event of next.activity.slice(start))
    Object.assign(event, context, { causationId: context.operationId });
  processAutomation(next, start);
  assertInvariants(next);
  return next;
}
