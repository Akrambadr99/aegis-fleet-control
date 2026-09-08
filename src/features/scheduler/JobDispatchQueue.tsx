import { useState } from 'react';
import { useFleet } from '../../app/FleetProvider';
import type { WarehouseJob } from '../../domain/jobs';
import { facilityPermission } from '../../domain/permissions';
import type { JobAssignment } from '../../application/jobDispatch';
import { JobQueuePanel } from './JobQueuePanel';
import { useJobDispatch } from './useJobDispatch';

export function JobDispatchQueue(props: {
  jobs: WarehouseJob[];
  selected: string;
  select: (id: string) => void;
  tick: number;
  facilityId: string;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]),
    [units, setUnits] = useState(1);
  const { gateway, actor } = useFleet();
  const { dispatch, runs, pending } = useJobDispatch(props.facilityId);
  const denied = facilityPermission(actor, props.facilityId, 'job.assign');
  function launch(ids: string[]) {
    const state = gateway.getSnapshot();
    const commands: JobAssignment[] = ids.map((id) => ({
      type: 'job.assign',
      id,
      expectedRevision: state.jobs[id]?.revision ?? 0,
      units,
      reason: '',
    }));
    dispatch(commands);
  }
  const latest = runs.at(-1);
  const failed =
    latest?.report?.outcomes
      .filter((outcome) => outcome.status === 'failed')
      .map((outcome) => outcome.jobId) ?? [];
  return (
    <JobQueuePanel
      {...props}
      batch={{
        selectedIds,
        toggle: (id) =>
          setSelectedIds((previous) =>
            previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id],
          ),
      }}
      toolbar={
        <section className="job-batch-controls" aria-label="Batch dispatch">
          <p>{selectedIds.length} jobs selected across queue filters</p>
          <label>
            Units per selected job
            <input
              type="number"
              min="1"
              step="1"
              value={units}
              onChange={(event) => setUnits(Number(event.target.value))}
            />
          </label>
          <button
            disabled={
              pending ||
              !!denied ||
              !selectedIds.length ||
              selectedIds.length > 50 ||
              !Number.isInteger(units) ||
              units < 1
            }
            onClick={() => launch(selectedIds)}
          >
            Dispatch selected jobs
          </button>
          <button disabled={!selectedIds.length} onClick={() => setSelectedIds([])}>
            Clear dispatch selection
          </button>
          {denied && <p>{denied}</p>}
          {runs.map((run) => (
            <div key={run.id} role="status">
              {run.status === 'pending' && (
                <>
                  <p>Dispatching {run.intent.commands.length} jobs…</p>
                  <button onClick={() => run.intent.cancellation.abort()}>
                    Cancel remaining dispatches
                  </button>
                </>
              )}
              {run.error && <p>{run.error.message}</p>}
              {run.report && (
                <>
                  <p>
                    {run.report.confirmed} confirmed · {run.report.failed} failed
                  </p>
                  <ul>
                    {run.report.outcomes.map((outcome) => (
                      <li key={outcome.jobId}>
                        {outcome.jobId}:{' '}
                        {outcome.status === 'failed'
                          ? outcome.message
                          : outcome.result.outcome === 'partial'
                            ? 'Assigned; follow-up action failed'
                            : 'Assigned'}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
          {!!failed.length && (
            <button
              disabled={pending || !!denied || !Number.isInteger(units) || units < 1}
              onClick={() => launch(failed)}
            >
              Retry failed jobs
            </button>
          )}
        </section>
      }
    />
  );
}
