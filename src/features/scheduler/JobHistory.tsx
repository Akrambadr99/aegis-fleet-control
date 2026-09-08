import type { WarehouseJob } from '../../domain/jobs';
import type { DomainState } from '../../domain/model';

export function JobHistory({ job, state }: { job: WarehouseJob; state: DomainState }) {
  const missions = (job.missionIds ?? []).map((id) => state.missions[id]).filter(Boolean);
  return (
    <section aria-label="Job mission history">
      <h2>Mission history</h2>
      {!missions.length && <p>No missions have been dispatched for this job.</p>}
      <ol>
        {missions.map((mission) => (
          <li key={mission.id}>
            <strong>{mission.id}</strong> · {mission.robotId} · {mission.status}
            <p>
              Plan {mission.planId} · {mission.progress}% route completion
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
