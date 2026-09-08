import { useState } from 'react';
import { useScope } from '../operations/useScope';
import { useCommand } from '../../hooks/useCommand';
import { CommandButton } from '../../components/CommandButton';
import { RuleEditor } from './RuleEditor';
export function AutomationWorkspace() {
  const { state, facility, params, change } = useScope(),
    { run, pending, message } = useCommand(),
    [creating, setCreating] = useState(false);
  const rules = Object.values(state.automationRules)
    .filter((r) => r.facilityId === facility.id)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const rule = rules.find((r) => r.id === params.get('rule')) ?? rules[0];
  const executions = state.automationRuns
    .filter(
      (r) =>
        state.automationRules[r.ruleId]?.facilityId === facility.id &&
        (!rule || r.ruleId === rule.id),
    )
    .slice(-30)
    .reverse();
  return (
    <div className="automation-workspace">
      <header className="editor-header">
        <div>
          <p className="eyebrow">EVENT RESPONSE</p>
          <h1>Automation rules</h1>
          <span>
            {rules.filter((r) => r.enabled).length} enabled rules · Tick {state.tick}
          </span>
        </div>
        <div className="editor-actions">
          <select
            aria-label="Automation facility"
            value={facility.id}
            onChange={(e) => {
              change('facility', e.target.value);
              setCreating(false);
            }}
          >
            {Object.values(state.facilities).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button onClick={() => setCreating(true)}>New rule</button>
        </div>
      </header>
      <div className="automation-layout">
        <section className="rule-library">
          <h2>Execution priority</h2>
          <ol>
            {rules.map((r) => (
              <li key={r.id}>
                <button
                  className="text-button"
                  onClick={() => {
                    change('rule', r.id);
                    setCreating(false);
                  }}
                >
                  {r.id} · {r.name}
                </button>
                <p>
                  P{r.priority} · {r.trigger} → {r.action}
                </p>
                <CommandButton
                  command={{
                    type: 'automation.toggle',
                    id: r.id,
                    expectedRevision: r.revision,
                    enabled: !r.enabled,
                  }}
                >
                  {r.enabled ? 'Disable' : 'Enable'} {r.id}
                </CommandButton>
              </li>
            ))}
          </ol>
        </section>
        {(creating || rule) && (
          <RuleEditor
            key={creating ? 'new-' + facility.id : rule.id + '-' + rule.revision}
            rule={creating ? undefined : rule}
            facilityId={facility.id}
            pending={pending}
            onSave={async (input) => {
              const id = creating ? 'AUTO-' + crypto.randomUUID() : rule.id;
              if (
                await run({
                  type: 'automation.save',
                  id,
                  expectedRevision: creating ? 0 : rule.revision,
                  input,
                })
              ) {
                change('rule', id);
                setCreating(false);
              }
            }}
          />
        )}
      </div>
      {message && <p role="status">{message}</p>}
      <section className="automation-history">
        <h2>Rule execution history</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tick</th>
                <th>Robot</th>
                <th>Action</th>
                <th>Outcome</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((e) => (
                <tr key={e.id}>
                  <td>{e.tick}</td>
                  <td>{e.robotId}</td>
                  <td>{e.action}</td>
                  <td>{e.status}</td>
                  <td>{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!executions.length && <p>No executions for this selected rule.</p>}
      </section>
    </div>
  );
}
