import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFleet, useDomain } from '../../app/FleetProvider';
import type { WarehouseJob } from '../../domain/jobs';
import { useCommand } from '../../hooks/useCommand';
import { commandPermission } from '../../domain/permissions';
import { jobProfiles } from '../../domain/jobKinds';
import { dispatchLockConflict } from '../../domain/jobLocks';
import { JobLockPanel } from './JobLockPanel';
export function CandidatePanel({ job }: { job: WarehouseJob }) {
  const state = useDomain(),
    { gateway, actor } = useFleet(),
    { run, pending, message } = useCommand();
  const [selected, setSelected] = useState(''),
    [releaseReason, setReleaseReason] = useState(''),
    [reason, setReason] = useState(''),
    [units, setUnits] = useState(1);
  const candidates = useQuery({
    queryKey: ['job-candidates', job.id, state.revision],
    queryFn: ({ signal }) => gateway.rankJobCandidates(job.id, signal).promise,
  });
  const closed = ['completed', 'cancelled'].includes(job.status),
    candidate = candidates.data?.find((c) => c.robotId === selected);
  const automatic = {
    type: 'job.assign' as const,
    id: job.id,
    expectedRevision: job.revision,
    units,
    reason: '',
  };
  const denied =
    commandPermission(state, actor, automatic) ?? dispatchLockConflict(job, actor.id, state.tick);
  return (
    <section className="candidate-panel">
      <h2>Robot candidates · {job.id}</h2>
      <JobLockPanel job={job} />
      <p>
        {job.completedUnits}/{job.units} completed
        {jobProfiles[job.kind ?? 'transport'].cargo && <> · Custody: {job.custody}</>}
      </p>
      <div className="assignment-controls">
        <label>
          Batch units
          <input
            type="number"
            min="1"
            max={job.units - job.completedUnits}
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
          />
        </label>
        <button
          disabled={
            pending || closed || !!denied || !candidates.data?.some((c) => !c.reasons.length)
          }
          onClick={() => run(automatic)}
        >
          Assign best candidate
        </button>
      </div>
      {denied && <p>{denied}</p>}
      {candidates.isPending ? (
        <p role="status">Ranking current fleet…</p>
      ) : candidates.isError ? (
        <>
          <p role="alert">{candidates.error.message}</p>
          <button onClick={() => candidates.refetch()}>Refresh ranking</button>
        </>
      ) : (
        <div className="candidate-list" role="list" aria-label="Ranked robot candidates">
          {candidates.data.map((c, index) => (
            <button
              role="listitem"
              key={c.robotId}
              className={selected === c.robotId ? 'candidate selected-candidate' : 'candidate'}
              onClick={() => setSelected(c.robotId)}
            >
              <strong>
                {index + 1}. {c.robotId}
              </strong>
              <span>
                {c.reasons.length
                  ? c.reasons.join(' · ')
                  : c.distance +
                    ' m · ' +
                    c.duration +
                    ' s · ' +
                    c.batteryRequired.toFixed(1) +
                    '% battery'}
              </span>
            </button>
          ))}
        </div>
      )}
      {candidate && (
        <div className="manual-assignment">
          <h3>Manual selection: {candidate.robotId}</h3>
          <label>
            Assignment reasoning
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain this operational choice"
            />
          </label>
          <button
            disabled={pending || closed || !!denied || !!candidate.reasons.length || !reason.trim()}
            onClick={() =>
              run({
                ...automatic,
                robotId: candidate.robotId,
                expectedRobotRevision: candidate.robotRevision,
                reason,
              })
            }
          >
            {job.robotId ? 'Reassign job' : 'Assign selected robot'}
          </button>
        </div>
      )}
      {job.assignmentReason && (
        <p className="assignment-reason">Last decision: {job.assignmentReason}</p>
      )}
      {job.missionId && !closed && (
        <fieldset disabled={pending || !!denied || job.custody === 'robot'}>
          <legend>Return assignment to queue</legend>
          <label>
            Release reason
            <input value={releaseReason} onChange={(e) => setReleaseReason(e.target.value)} />
          </label>
          <button
            disabled={!releaseReason.trim()}
            onClick={() =>
              run({
                type: 'job.release',
                id: job.id,
                expectedRevision: job.revision,
                reason: releaseReason,
              })
            }
          >
            Release assignment
          </button>
          <p>Releases this mission and its reservations. Dispatch again to create a new attempt.</p>
        </fieldset>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
