import type { MissionPlan } from '../../domain/planning';
export function DependencyGraph({ plan }: { plan: MissionPlan }) {
  const width = Math.max(480, plan.steps.length * 125);
  return (
    <section className="dependency-strip">
      <h2>Dependencies & branches</h2>
      <svg viewBox={'0 0 ' + width + ' 115'} role="img" aria-label="Mission dependency graph">
        <defs>
          <marker
            id="dependency-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#557078" />
          </marker>
        </defs>
        {plan.steps.flatMap((step, i) =>
          step.dependsOn.map((id) => {
            const from = plan.steps.findIndex((s) => s.id === id);
            return from < 0 ? null : (
              <path
                key={step.id + id}
                d={
                  'M ' +
                  (from * 125 + 60) +
                  ' 55 Q ' +
                  ((from + i) * 62.5 + 60) +
                  ' 5 ' +
                  (i * 125 + 60) +
                  ' 55'
                }
                fill="none"
                stroke="#557078"
                markerEnd="url(#dependency-arrow)"
              />
            );
          }),
        )}
        {plan.steps.map((step, i) => (
          <g key={step.id}>
            <rect
              x={i * 125 + 8}
              y="56"
              width="108"
              height="36"
              fill={step.condition === 'always' ? '#e5eeeb' : '#fff0ce'}
              stroke="#78918a"
            />
            <text x={i * 125 + 62} y="78" textAnchor="middle" fontSize="11">
              {step.id} · {step.kind}
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
}
