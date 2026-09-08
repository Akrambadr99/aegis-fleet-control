import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useEffect, useReducer, useState } from 'react';
import { useDomain, useFleet } from '../../app/FleetProvider';
import { newPlan, newStep, type MissionPlan, type PlanValidation } from '../../domain/planning';
import { commandPermission } from '../../domain/permissions';
import { draftReducer, initialHistory, moveStep } from './draftHistory';
import { StepInspector } from './StepInspector';
import { StepSequence } from './StepSequence';
import { DependencyGraph } from './DependencyGraph';
export function MissionPlanning() {
  const state = useDomain(),
    { gateway, actor } = useFleet();
  const [history, dispatch] = useReducer(draftReducer, undefined, () =>
    initialHistory(newPlan('PLAN-' + crypto.randomUUID(), 'FAC-001', 'R-001')),
  );
  const plan = history.present,
    key = JSON.stringify(plan),
    dirty = key !== JSON.stringify(history.baseline);
  const [selected, setSelected] = useState(''),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState('');
  const [pending, setPending] = useState<MissionPlan | null>(null),
    [retry, setRetry] = useState(0);
  const [validation, setValidation] = useState<{
    key: string;
    revision: number;
    result?: PlanValidation;
    error?: string;
  }>({ key: '', revision: -1 });
  useEffect(() => {
    const controller = new AbortController();
    gateway
      .validateMissionPlan(plan, controller.signal)
      .promise.then((result) => setValidation({ key, revision: result.stateRevision, result }))
      .catch((error) => {
        if (!controller.signal.aborted)
          setValidation({ key, revision: state.revision, error: error.message });
      });
    return () => controller.abort();
  }, [gateway, plan, key, state.revision, retry]);
  const current = validation.key === key && validation.revision === state.revision;
  const command = {
    type: 'plan.save' as const,
    id: plan.id,
    expectedRevision: history.baseline.revision,
    plan,
  };
  const denied = commandPermission(state, actor, command);
  const edit = (next: MissionPlan) => {
    dispatch({ type: 'edit', plan: next });
    setMessage('');
  };
  function reset(next: MissionPlan) {
    dispatch({ type: 'reset', plan: next });
    setSelected(next.steps[0]?.id ?? '');
    setMessage('');
  }
  function open(next: MissionPlan) {
    if (dirty) setPending(next);
    else reset(next);
  }
  function add() {
    let n = 1;
    while (plan.steps.some((s) => s.id === 'S-' + n)) n++;
    const step = {
      ...newStep('S-' + n),
      zoneId: state.floors[state.robots[plan.robotId].floorId].zoneIds.at(-1)!,
      dependsOn: plan.steps.length ? [plan.steps.at(-1)!.id] : [],
    };
    edit({ ...plan, steps: [...plan.steps, step] });
    setSelected(step.id);
  }
  async function save() {
    setSaving(true);
    setMessage('');
    try {
      await gateway.command(actor, command).promise;
      reset(gateway.getSnapshot().plans[plan.id]);
      setMessage('Mission plan saved');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="mission-workspace">
      <header className="editor-header">
        <div>
          <p className="eyebrow">MISSION PLANNING</p>
          <h1>Mission editor</h1>
          <span>
            {plan.revision ? 'Revision ' + plan.revision : 'Unsaved draft'}
            {dirty ? ' · Modified' : ''}
          </span>
        </div>
        <div className="editor-actions">
          <button
            disabled={saving || !history.past.length}
            onClick={() => dispatch({ type: 'undo' })}
          >
            Undo
          </button>
          <button
            disabled={saving || !history.future.length}
            onClick={() => dispatch({ type: 'redo' })}
          >
            Redo
          </button>
          <button
            disabled={saving}
            onClick={() =>
              open({
                ...structuredClone(plan),
                id: 'PLAN-' + crypto.randomUUID(),
                revision: 0,
                title: plan.title + ' copy',
              })
            }
          >
            Duplicate mission
          </button>
          <button disabled={saving || !dirty} onClick={() => setPending(history.baseline)}>
            Cancel draft
          </button>
          <button
            disabled={
              saving ||
              !!denied ||
              !current ||
              !!validation.error ||
              !validation.result ||
              !!validation.result.issues.length ||
              (!dirty && plan.revision > 0)
            }
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save mission'}
          </button>
        </div>
      </header>
      {message && (
        <p role="status" className="editor-message">
          {message}
        </p>
      )}
      {denied && <p>{denied}</p>}
      <div className="mission-editor-layout">
        <nav className="plan-library" aria-label="Saved mission plans">
          <h2>Mission plans</h2>
          <button
            disabled={saving}
            onClick={() =>
              open(newPlan('PLAN-' + crypto.randomUUID(), plan.facilityId, plan.robotId))
            }
          >
            New mission
          </button>
          {Object.values(state.plans).map((p) => (
            <button
              disabled={saving}
              key={p.id}
              aria-current={p.id === plan.id ? 'true' : undefined}
              onClick={() => open(p)}
            >
              {p.title}
              <small>
                {p.robotId} · rev {p.revision}
              </small>
            </button>
          ))}
          {!Object.keys(state.plans).length && (
            <p>No saved plans. Drafts remain local until saved.</p>
          )}
        </nav>
        <fieldset className="mission-document" disabled={saving}>
          <legend className="sr-only">Mission draft</legend>
          <div className="mission-metadata">
            <label>
              Mission title
              <input
                value={plan.title}
                onChange={(e) => edit({ ...plan, title: e.target.value })}
              />
            </label>
            <label>
              Facility
              <select
                value={plan.facilityId}
                disabled={plan.revision > 0}
                onChange={(e) =>
                  edit({
                    ...plan,
                    facilityId: e.target.value,
                    robotId: Object.values(state.robots).find(
                      (r) => r.facilityId === e.target.value,
                    )!.id,
                  })
                }
              >
                {Object.values(state.facilities).map((f) => (
                  <option value={f.id} key={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assigned robot
              <select
                value={plan.robotId}
                onChange={(e) => edit({ ...plan, robotId: e.target.value })}
              >
                {Object.values(state.robots)
                  .filter((r) => r.facilityId === plan.facilityId)
                  .map((r) => (
                    <option key={r.id}>{r.id}</option>
                  ))}
              </select>
            </label>
          </div>
          <div className="sequence-toolbar">
            <button onClick={add}>Add step</button>
            <span>Drag to reorder · Use arrows for keyboard ordering</span>
          </div>
          <div className="sequence-and-inspector">
            <StepSequence
              plan={plan}
              selected={selected}
              select={setSelected}
              move={(id, index) => edit(moveStep(plan, id, index))}
              remove={(id) => {
                edit({
                  ...plan,
                  steps: plan.steps
                    .filter((s) => s.id !== id)
                    .map((s) => ({ ...s, dependsOn: s.dependsOn.filter((d) => d !== id) })),
                });
                if (selected === id) setSelected('');
              }}
            />
            <StepInspector
              plan={plan}
              step={plan.steps.find((s) => s.id === selected)}
              state={state}
              update={(step) =>
                edit({ ...plan, steps: plan.steps.map((s) => (s.id === step.id ? step : s)) })
              }
            />
          </div>
          <DependencyGraph plan={plan} />
        </fieldset>
      </div>
      <section className="validation-tray" aria-label="Mission feasibility">
        <h2>Feasibility</h2>
        {!current ? (
          <p role="status">Validating current draft…</p>
        ) : validation.error ? (
          <>
            <p role="alert">{validation.error}</p>
            <button onClick={() => setRetry((n) => n + 1)}>Retry validation</button>
          </>
        ) : (
          <>
            <p>
              {validation.result?.issues.length
                ? 'Resolve constraints before saving'
                : 'Mission feasible'}{' '}
              · {validation.result?.distance} m · {validation.result?.durationSeconds} s critical
              path · {validation.result?.batteryRequired}% travel battery
            </p>
            <ul>
              {validation.result?.issues.map((i, n) => (
                <li key={n}>
                  {i.stepId ? i.stepId + ': ' : ''}
                  {i.message}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      {pending && (
        <ConfirmDialog
          title="Discard unsaved mission changes?"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            reset(pending);
            setPending(null);
          }}
        >
          <p>The saved mission will remain unchanged.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
