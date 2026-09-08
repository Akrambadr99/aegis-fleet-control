import {
  assertCapabilityEnabled,
  defaultConfiguration,
  type OperationalConfiguration,
} from './configuration';
import type { DomainState } from '../domain/model';
import { automationAction, evaluateRule } from '../domain/automation';
import { applyCommand, record } from '../domain/transactions';
export function processAutomation(
  state: DomainState,
  eventStart: number,
  configuration: Readonly<OperationalConfiguration> = defaultConfiguration,
) {
  const rules = Object.values(state.automationRules)
    .filter((r) => r.enabled)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  if (!rules.length) return;
  let cursor = eventStart,
    processed = 0;
  while (cursor < state.activity.length && processed++ < 64) {
    const event = state.activity[cursor++];
    for (const rule of rules) {
      if (rule.trigger !== event.type) continue;
      for (const target of evaluateRule(state, rule, event).filter((t) => t.matched)) {
        if (
          state.automationRuns.some(
            (r) =>
              r.ruleId === rule.id &&
              r.robotId === target.robotId &&
              r.tick > state.tick - rule.cooldownTicks,
          )
        )
          continue;
        let status: 'confirmed' | 'skipped' | 'failed' = 'skipped',
          message = 'No action required';
        try {
          const command = automationAction(state, rule, state.robots[target.robotId]);
          if (command) {
            assertCapabilityEnabled(command, configuration);
            const candidate = structuredClone(state);
            const childStart = candidate.activity.length;
            applyCommand(candidate, rule.owner, command);
            for (const child of candidate.activity.slice(childStart))
              Object.assign(child, {
                operationId: event.operationId,
                correlationId: event.correlationId ?? event.id,
                causationId: event.id,
              });
            Object.assign(state, candidate);
            status = 'confirmed';
            message = command.type + ' confirmed';
          }
        } catch (error) {
          status = 'failed';
          message = error instanceof Error ? error.message : 'Action failed';
        }
        state.automationRuns.push({
          id: 'AUTO-RUN-' + state.revision + '-' + state.automationRuns.length,
          ruleId: rule.id,
          eventId: event.id,
          robotId: target.robotId,
          tick: state.tick,
          action: rule.action,
          status,
          message,
        });
        record(state, rule.owner, 'automation.' + status, rule.id, message, [
          state.robots[target.robotId],
        ]);
        Object.assign(state.activity.at(-1)!, {
          operationId: event.operationId,
          correlationId: event.correlationId ?? event.id,
          causationId: event.id,
        });
      }
    }
  }
}
