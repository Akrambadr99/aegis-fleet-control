import { useState } from 'react';
import { useFleet } from '../../app/FleetProvider';
import { useScope } from '../../hooks/useWorkspaceScope';
import { JobDispatchQueue } from './JobDispatchQueue';
import { JobDependencies } from './JobDependencies';
import { JobEditor } from './JobEditor';
import { CandidatePanel } from './CandidatePanel';
import { JobHistory } from './JobHistory';
import { useCommand } from '../../hooks/useCommand';
import { commandPermission } from '../../domain/permissions';
export function SchedulerWorkspace() {
  const { state, facility, params, change } = useScope(),
    { gateway, actor } = useFleet(),
    { run, pending, message } = useCommand();
  const [creating, setCreating] = useState(false),
    [cancelReason, setCancelReason] = useState('');
  const jobs = Object.values(state.jobs)
    .filter((j) => j.facilityId === facility.id)
    .sort(
      (a, b) =>
        b.priority - a.priority || a.deadlineTick - b.deadlineTick || a.id.localeCompare(b.id),
    );
  const job = jobs.find((j) => j.id === params.get('job')) ?? jobs[0];
  const cancel = job
    ? {
        type: 'job.cancel' as const,
        id: job.id,
        expectedRevision: job.revision,
        reason: cancelReason,
      }
    : null;
  return (
    <div className="scheduler-workspace">
      <header className="editor-header">
        <div>
          <p className="eyebrow">FLEET DISPATCH</p>
          <h1>Jobs & scheduler</h1>
          <span>Operating tick {state.tick} · Delivery commitments and fleet eligibility</span>
        </div>
        <div className="editor-actions">
          <select
            aria-label="Scheduling facility"
            value={facility.id}
            onChange={(e) => {
              change('facility', e.target.value);
              setCreating(false);
            }}
          >
            {Object.values(state.facilities).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button onClick={() => gateway.advance(100)}>Advance 100 seconds</button>
          <button onClick={() => setCreating(true)}>New warehouse job</button>
        </div>
      </header>
      <div className="dispatch-timeline" aria-label="Job deadlines">
        {jobs
          .filter((j) => !['completed', 'cancelled'].includes(j.status))
          .map((j) => (
            <button
              key={j.id}
              onClick={() => {
                change('job', j.id);
                setCreating(false);
              }}
            >
              <strong>{j.id}</strong>
              <span>
                P{j.priority} · due {j.deadlineTick}
              </span>
              <progress
                max={j.units}
                value={j.completedUnits}
                aria-label={j.id + ' delivery completion'}
              />
            </button>
          ))}
      </div>
      <div className="scheduler-grid">
        <div>
          <JobDispatchQueue
            key={facility.id}
            facilityId={facility.id}
            jobs={jobs}
            selected={job?.id ?? ''}
            tick={state.tick}
            select={(id) => {
              change('job', id);
              setCreating(false);
            }}
          />
          {job && (
            <JobDependencies
              job={job}
              jobs={jobs}
              select={(id) => {
                change('job', id);
                setCreating(false);
              }}
            />
          )}
          {job && <JobHistory job={job} state={state} />}
          {(creating || job) && (
            <JobEditor
              key={creating ? 'new-' + facility.id : job.id + '-' + job.revision}
              state={state}
              facilityId={facility.id}
              job={creating ? undefined : job}
              pending={pending}
              onSave={async (input) => {
                const id = creating ? 'JOB-' + crypto.randomUUID() : job.id;
                if (
                  await run({
                    type: 'job.save',
                    id,
                    expectedRevision: creating ? 0 : job.revision,
                    input,
                  })
                ) {
                  change('job', id);
                  setCreating(false);
                }
              }}
            />
          )}
        </div>
        {job && !creating && <CandidatePanel key={job.id} job={job} />}
      </div>
      {job && !creating && !['completed', 'cancelled'].includes(job.status) && (
        <section className="job-cancellation">
          <label>
            Cancellation reason
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </label>
          <button
            disabled={
              pending ||
              !cancelReason.trim() ||
              !!(cancel && commandPermission(state, actor, cancel))
            }
            onClick={() => cancel && run(cancel)}
          >
            Cancel job {job.id}
          </button>
          <span>Payload custody prevents unsafe cancellation after pickup.</span>
        </section>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
