import type { DomainState } from '../../domain/model';
import { stepKinds, type MissionPlan, type MissionStep } from '../../domain/planning';
export function StepInspector({
  plan,
  step,
  state,
  update,
}: {
  plan: MissionPlan;
  step: MissionStep | undefined;
  state: DomainState;
  update: (step: MissionStep) => void;
}) {
  if (!step)
    return (
      <aside className="step-inspector">
        <h2>Step inspector</h2>
        <p>Select a step to edit its constraints.</p>
      </aside>
    );
  const patch = (values: Partial<MissionStep>) => update({ ...step, ...values });
  return (
    <aside className="step-inspector" aria-label="Step inspector">
      <h2>{step.label || step.id}</h2>
      <label>
        Step label
        <input value={step.label} onChange={(e) => patch({ label: e.target.value })} />
      </label>
      <label>
        Step type
        <select
          value={step.kind}
          onChange={(e) => patch({ kind: e.target.value as MissionStep['kind'] })}
        >
          {stepKinds.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <label>
        Run condition
        <select
          value={step.condition}
          onChange={(e) => patch({ condition: e.target.value as MissionStep['condition'] })}
        >
          <option value="always">Always</option>
          <option value="battery-low">Battery below 30%</option>
          <option value="fault-present">Unresolved fault present</option>
        </select>
      </label>
      {step.kind === 'navigate' && (
        <label>
          Destination zone
          <select value={step.zoneId} onChange={(e) => patch({ zoneId: e.target.value })}>
            <option value="">Choose destination</option>
            {Object.values(state.zones)
              .filter((z) => state.floors[z.floorId].facilityId === plan.facilityId)
              .map((z) => (
                <option value={z.id} key={z.id}>
                  {z.id} · {z.name}
                </option>
              ))}
          </select>
        </label>
      )}
      {['pickup', 'dropoff'].includes(step.kind) && (
        <label>
          Payload kg
          <input
            type="number"
            min="1"
            value={step.payloadKg}
            onChange={(e) => patch({ payloadKg: Number(e.target.value) })}
          />
        </label>
      )}
      {['wait', 'inspect', 'charge', 'resource'].includes(step.kind) && (
        <label>
          Duration seconds
          <input
            type="number"
            min="0"
            value={step.seconds}
            onChange={(e) => patch({ seconds: Number(e.target.value) })}
          />
        </label>
      )}
      {step.kind === 'charge' && (
        <label>
          Charging station
          <select value={step.chargerId} onChange={(e) => patch({ chargerId: e.target.value })}>
            <option value="">Choose charger</option>
            {Object.values(state.chargers)
              .filter((c) => c.facilityId === plan.facilityId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.available ? 'available' : 'out of service'}
                </option>
              ))}
          </select>
        </label>
      )}
      {step.kind === 'resource' && (
        <label>
          Resource identifier
          <input value={step.resourceId} onChange={(e) => patch({ resourceId: e.target.value })} />
        </label>
      )}
      <fieldset>
        <legend>Wait for these steps</legend>
        {plan.steps
          .filter((s) => s.id !== step.id)
          .map((s) => (
            <label className="check-label" key={s.id}>
              <input
                type="checkbox"
                checked={step.dependsOn.includes(s.id)}
                onChange={(e) =>
                  patch({
                    dependsOn: e.target.checked
                      ? [...step.dependsOn, s.id]
                      : step.dependsOn.filter((id) => id !== s.id),
                  })
                }
              />
              {s.label || s.id} · {s.kind}
            </label>
          ))}
        <small>
          Independent steps form parallel branches. Multiple dependencies join branches.
        </small>
      </fieldset>
    </aside>
  );
}
