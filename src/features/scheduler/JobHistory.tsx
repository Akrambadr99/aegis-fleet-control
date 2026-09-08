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
              Plan {mission.planId} · {mission.progress.toFixed(1)}% route completion
            </p>
            {job.attempts
              ?.filter((attempt) => attempt.missionId === mission.id)
              .map((attempt) => (
                <div key={attempt.missionId}>
                  <p>
                    {attempt.units} units · assigned by {attempt.assignedBy} at tick{' '}
                    {attempt.assignedAt} · {attempt.reason}
                  </p>
                  <p>
                    Attempt {attempt.outcome}
                    {attempt.endedAt !== undefined &&
                      ` at tick ${attempt.endedAt} by ${attempt.endedBy}: ${attempt.endReason}`}
                  </p>
                </div>
              ))}
          </li>
        ))}
      </ol>
    </section>
  );
}
