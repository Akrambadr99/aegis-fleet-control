import {
  assertCapabilityEnabled,
  defaultConfiguration,
  type OperationalConfiguration,
} from './configuration';
import type { Actor, Command, DomainState } from '../domain/model';
import { applyCommand } from '../domain/transactions';
import { assertInvariants } from '../domain/invariants';
import { processAutomation } from './automationEngine';
export interface OperationContext {
  operationId: string;
  correlationId: string;
}

export interface TransactionCandidate {
  state: DomainState;
  eventRange: { start: number; length: number };
}

/** One candidate state, including automation consequences; callers publish only on success. */
export function executeTransaction(
  state: DomainState,
  actor: Actor,
  command: Command,
  context: OperationContext,
  config: Readonly<OperationalConfiguration> = defaultConfiguration,
): TransactionCandidate {
  assertCapabilityEnabled(command, config);
  const next = structuredClone(state);
  const start = next.activity.length;
  applyCommand(next, actor, command);
  for (const event of next.activity.slice(start))
    Object.assign(event, context, { causationId: context.operationId });
  if (config.automatedRecovery) processAutomation(next, start, config);
  assertInvariants(next);
  return { state: next, eventRange: { start, length: next.activity.length - start } };
}
