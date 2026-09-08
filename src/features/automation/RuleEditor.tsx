import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDomain, useFleet } from '../../app/FleetProvider';
import {
  automationActions,
  automationTriggers,
  type AutomationRule,
  type RuleInput,
} from '../../domain/automation';
import { RuleTester } from './RuleTester';
export function RuleEditor({
  rule,
  facilityId,
  pending,
  onSave,
}: {
  rule?: AutomationRule;
  facilityId: string;
  pending: boolean;
  onSave: (input: RuleInput) => void;
}) {
  const state = useDomain(),
    { gateway } = useFleet();
  const [input, setInput] = useState<RuleInput>(() =>
    rule
      ? {
          name: rule.name,
          facilityId: rule.facilityId,
          enabled: rule.enabled,
          priority: rule.priority,
          trigger: rule.trigger,
          action: rule.action,
          batteryBelow: rule.batteryBelow,
          minimumOccurrences: rule.minimumOccurrences,
          cooldownTicks: rule.cooldownTicks,
        }
      : {
          name: 'New operational rule',
          facilityId,
          enabled: false,
          priority: 5,
          trigger: 'robot.low-battery',
          action: 'schedule-charging',
          batteryBelow: 30,
          minimumOccurrences: 1,
          cooldownTicks: 60,
        },
  );
  const patch = (value: Partial<RuleInput>) => setInput({ ...input, ...value });
  const validation = useQuery({
    queryKey: ['rule-validation', input, state.revision],
    queryFn: ({ signal }) => gateway.validateAutomation(input, undefined, signal).promise,
  });
  return (
    <section className="rule-editor">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(input);
        }}
      >
        <h2>{rule ? 'Rule configuration' : 'Create automation rule'}</h2>
        <fieldset disabled={pending}>
          <label>
            Rule name
            <input value={input.name} onChange={(e) => patch({ name: e.target.value })} />
          </label>
          <div className="rule-chain">
            <label>
              When event
              <select
                value={input.trigger}
                onChange={(e) => patch({ trigger: e.target.value as RuleInput['trigger'] })}
              >
                {automationTriggers.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <span>→</span>
            <label>
              Then action
              <select
                value={input.action}
                onChange={(e) => patch({ action: e.target.value as RuleInput['action'] })}
              >
                {automationActions.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-pair">
            <label>
              Battery at or below
              <input
                type="number"
                min="0"
                max="100"
                value={input.batteryBelow}
                onChange={(e) => patch({ batteryBelow: Number(e.target.value) })}
              />
            </label>
            <label>
              Occurrences in 600 seconds
              <input
                type="number"
                min="1"
                max="10"
                value={input.minimumOccurrences}
                onChange={(e) => patch({ minimumOccurrences: Number(e.target.value) })}
              />
            </label>
            <label>
              Rule priority
              <input
                type="number"
                min="1"
                max="10"
                value={input.priority}
                onChange={(e) => patch({ priority: Number(e.target.value) })}
              />
            </label>
            <label>
              Cooldown seconds
              <input
                type="number"
                min="1"
                max="3600"
                value={input.cooldownTicks}
                onChange={(e) => patch({ cooldownTicks: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={input.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
            />
            Enabled after save
          </label>
          {validation.isPending ? (
            <p role="status">Validating rule…</p>
          ) : validation.isError ? (
            <p role="alert">{validation.error.message}</p>
          ) : validation.data.issues.length ? (
            <ul>
              {validation.data.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : (
            <p>Rule constraints valid</p>
          )}
          <button
            disabled={
              pending ||
              validation.isPending ||
              validation.isError ||
              !!validation.data?.issues.length
            }
          >
            Save rule
          </button>
        </fieldset>
      </form>
      <RuleTester input={input} />
    </section>
  );
}
