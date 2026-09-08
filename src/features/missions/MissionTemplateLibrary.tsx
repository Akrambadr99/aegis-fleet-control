import { useState } from 'react';
import { useDomain, useFleet } from '../../app/FleetProvider';
import { commandPermission } from '../../domain/permissions';
import { instantiateTemplate } from '../../domain/missionTemplates';
import type { MissionPlan } from '../../domain/planning';

export function MissionTemplateLibrary({
  plan,
  disabled,
  open,
}: {
  plan: MissionPlan;
  disabled: boolean;
  open: (plan: MissionPlan) => void;
}) {
  const state = useDomain(),
    { actor, gateway } = useFleet();
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState('');
  const source = state.plans[plan.id];
  const command = {
    type: 'template.create' as const,
    id: '',
    sourcePlanId: plan.id,
    sourceRevision: source?.revision ?? 0,
    title: source?.title ?? '',
  };
  const denied = commandPermission(state, actor, command);
  async function create() {
    setPending(true);
    setMessage('');
    try {
      await gateway.command(actor, { ...command, id: 'TPL-' + crypto.randomUUID() }).promise;
      setMessage('Template created from the saved revision');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Template creation failed');
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="mission-template-library" aria-label="Mission templates">
      <h2>Mission templates</h2>
      <p>
        Templates keep the saved step graph for this facility. Each use creates a new draft and
        rechecks current constraints.
      </p>
      <button disabled={disabled || pending || !source || !!denied} onClick={create}>
        {pending ? 'Creating template…' : 'Create template from saved revision'}
      </button>
      {!source && <p>Save a mission before creating its template.</p>}
      {message && <p role="status">{message}</p>}
      <ul>
        {Object.values(state.missionTemplates)
          .filter((template) => template.facilityId === plan.facilityId)
          .map((template) => (
            <li key={template.id}>
              <strong>{template.title}</strong> · {template.plan.steps.length} steps · source
              revision {template.sourceRevision}
              <button
                disabled={disabled}
                onClick={() =>
                  open(
                    instantiateTemplate(
                      template,
                      'PLAN-' + crypto.randomUUID(),
                      plan.robotId,
                      actor.id,
                    ),
                  )
                }
              >
                Use template {template.title}
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
}
