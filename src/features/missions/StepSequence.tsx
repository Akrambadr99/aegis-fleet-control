import type { MissionPlan } from '../../domain/planning';
export function StepSequence({
  plan,
  selected,
  select,
  move,
  remove,
  insert,
  duplicate,
}: {
  plan: MissionPlan;
  selected: string;
  select: (id: string) => void;
  move: (id: string, index: number) => void;
  remove: (id: string) => void;
  insert: (index: number) => void;
  duplicate: (id: string, index: number) => void;
}) {
  return (
    <section className="step-sequence" aria-label="Mission step sequence">
      <h2>Execution sequence</h2>
      <ol>
        {plan.steps.map((step, index) => (
          <li
            key={step.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/plain', step.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              move(e.dataTransfer.getData('text/plain'), index);
            }}
            className={selected === step.id ? 'selected' : ''}
          >
            <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
            <button
              className="step-select"
              aria-pressed={selected === step.id}
              onClick={() => select(step.id)}
            >
              {step.label || step.id}
              <small>
                {step.kind} · {step.condition === 'always' ? 'unconditional' : step.condition}
              </small>
            </button>
            <div className="step-order">
              <button aria-label={'Insert before ' + step.id} onClick={() => insert(index)}>
                +
              </button>
              <button
                aria-label={'Duplicate ' + step.id}
                onClick={() => duplicate(step.id, index + 1)}
              >
                Copy
              </button>
              <button
                aria-label={'Move ' + step.id + ' up'}
                disabled={!index}
                onClick={() => move(step.id, index - 1)}
              >
                ↑
              </button>
              <button
                aria-label={'Move ' + step.id + ' down'}
                disabled={index === plan.steps.length - 1}
                onClick={() => move(step.id, index + 1)}
              >
                ↓
              </button>
              <button aria-label={'Remove ' + step.id} onClick={() => remove(step.id)}>
                ×
              </button>
            </div>
            <p className="step-dependencies">
              {step.dependsOn.length ? 'After ' + step.dependsOn.join(', ') : 'Independent branch'}
            </p>
          </li>
        ))}
      </ol>
      {!plan.steps.length && <p>Add the first step to define this mission.</p>}
    </section>
  );
}
