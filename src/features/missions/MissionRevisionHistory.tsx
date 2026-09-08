import type { MissionPlan, MissionPlanRevision } from '../../domain/planning';

export function MissionRevisionHistory({
  revisions,
  disabled,
  restore,
}: {
  revisions: MissionPlanRevision[];
  disabled: boolean;
  restore: (plan: MissionPlan) => void;
}) {
  return (
    <section aria-label="Mission revision history">
      <h2>Revision history</h2>
      {!revisions.length && <p>Save this plan to record its first revision.</p>}
      {revisions.map((entry) => (
        <details key={entry.id}>
          <summary>
            Revision {entry.revision} · {entry.plan.title}
          </summary>
          <p>
            {entry.savedBy} · tick {entry.savedAtTick} · {entry.plan.robotId}
          </p>
          <ol>
            {entry.plan.steps.map((step) => (
              <li key={step.id}>
                {step.label || step.id} · {step.kind}
              </li>
            ))}
          </ol>
          <button disabled={disabled} onClick={() => restore(entry.plan)}>
            Restore revision {entry.revision} as draft
          </button>
        </details>
      ))}
    </section>
  );
}
