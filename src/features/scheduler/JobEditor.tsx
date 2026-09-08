import { useState } from 'react';
import type { DomainState } from '../../domain/model';
import type { JobInput, WarehouseJob } from '../../domain/jobs';
import { jobKinds, jobProfiles, jobActions, type JobKind } from '../../domain/jobKinds';
import {
  newJobDraft,
  jobInputSnapshot,
  reconcileJobDraft,
  rebaseJobDraft,
  changedJobFields,
  jobFieldLabels,
} from './jobDraft';
export function JobEditor({
  state,
  facilityId,
  job,
  pending,
  blockedReason,
  onSave,
}: {
  state: DomainState;
  facilityId: string;
  job?: WarehouseJob;
  pending: boolean;
  blockedReason?: string | null;
  onSave: (input: JobInput, expectedRevision: number) => void;
}) {
  const zones = Object.values(state.zones).filter(
    (z) => state.floors[z.floorId].facilityId === facilityId,
  );
  const [session, setSession] = useState(() =>
    newJobDraft(
      job
        ? jobInputSnapshot(job)
        : {
            title: 'Dock transfer request',
            kind: 'transport',
            requiredActions: [],
            facilityId,
            sourceZoneId: zones[1]?.id ?? '',
            destinationZoneId: zones[4]?.id ?? '',
            payloadKg: 60,
            units: 4,
            priority: 3,
            deadlineTick: state.tick + 1800,
            dependsOn: [],
          },
      job?.revision ?? 0,
    ),
  );
  const draft = session.draft;
  const incoming = job ? jobInputSnapshot(job) : session.baseline;
  if (job && job.revision !== session.observedRevision)
    setSession(reconcileJobDraft(session, incoming, job.revision));
  const conflict = session.baselineRevision !== session.observedRevision;
  const patch = (value: Partial<JobInput>) =>
    setSession((previous) => ({ ...previous, draft: { ...previous.draft, ...value } }));
  return (
    <form
      className="job-editor"
      onSubmit={(e) => {
        e.preventDefault();
        if (!conflict && !pending && !blockedReason) onSave(draft, session.baselineRevision);
      }}
    >
      <h2>{job ? 'Job requirements' : 'New warehouse job'}</h2>
      {blockedReason && <p role="status">{blockedReason}</p>}
      {conflict && job && (
        <section role="alert">
          <p>
            This job's requirements changed. Your edits are retained. Changed fields:{' '}
            {changedJobFields(session.baseline, incoming)
              .map((key) => jobFieldLabels[key])
              .join(', ')}
            .
          </p>
          <dl>
            {changedJobFields(session.baseline, incoming).map((key) => (
              <div key={key}>
                <dt>{jobFieldLabels[key]}</dt>
                <dd>
                  Current: {String(incoming[key] ?? 'None')} · Your draft:{' '}
                  {String(draft[key] ?? 'None')}
                </dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            disabled={pending}
            onClick={() => setSession(newJobDraft(incoming, job.revision))}
          >
            Reload current requirements
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setSession(rebaseJobDraft(session, incoming, job.revision))}
          >
            Apply my edited fields
          </button>
        </section>
      )}
      <fieldset
        disabled={
          pending ||
          !!blockedReason ||
          (!!job && !['queued', 'partially-completed'].includes(job.status))
        }
      >
        <label>
          Job title
          <input required value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
        </label>
        <label>
          Job kind
          <select
            value={draft.kind}
            disabled={!!job?.completedUnits}
            onChange={(e) => {
              const kind = e.target.value as JobKind;
              patch({ kind, payloadKg: jobProfiles[kind].cargo ? draft.payloadKg || 60 : 0 });
            }}
          >
            {jobKinds.map((kind) => (
              <option key={kind} value={kind}>
                {jobProfiles[kind].label}
              </option>
            ))}
          </select>
        </label>
        <p>Required capabilities: {jobActions(draft).join(', ')}</p>
        <fieldset disabled={!!job?.completedUnits}>
          <legend>Additional capabilities</legend>
          {(['lift', 'inspect'] as const).map((action) => (
            <label className="check-label" key={action}>
              <input
                type="checkbox"
                checked={(draft.requiredActions ?? []).includes(action)}
                onChange={(e) =>
                  patch({
                    requiredActions: e.target.checked
                      ? [...(draft.requiredActions ?? []), action]
                      : (draft.requiredActions ?? []).filter((value) => value !== action),
                  })
                }
              />
              {action}
            </label>
          ))}
        </fieldset>
        {!!job?.completedUnits && (
          <p>Completed units lock the job kind, stations, payload and capabilities.</p>
        )}
        <div className="form-pair">
          {(['sourceZoneId', 'destinationZoneId'] as const).map((field) => (
            <label key={field}>
              {field === 'sourceZoneId' ? 'Source station' : 'Destination station'}
              <select
                disabled={!!job?.completedUnits}
                value={draft[field]}
                onChange={(e) => patch({ [field]: e.target.value })}
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.id} · {z.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="form-pair">
          <label>
            Payload kg
            <input
              type="number"
              min={jobProfiles[draft.kind ?? 'transport'].cargo ? 1 : 0}
              disabled={!!job?.completedUnits || !jobProfiles[draft.kind ?? 'transport'].cargo}
              value={draft.payloadKg}
              onChange={(e) => patch({ payloadKg: Number(e.target.value) })}
            />
          </label>
          <label>
            Total units
            <input
              type="number"
              min="1"
              value={draft.units}
              onChange={(e) => patch({ units: Number(e.target.value) })}
            />
          </label>
          <label>
            Job priority
            <select
              value={draft.priority}
              onChange={(e) => patch({ priority: Number(e.target.value) })}
            >
              {[5, 4, 3, 2, 1].map((p) => (
                <option key={p} value={p}>
                  P{p}
                </option>
              ))}
            </select>
          </label>
          <label>
            Deadline tick
            <input
              type="number"
              min={state.tick + 1}
              value={draft.deadlineTick}
              onChange={(e) => patch({ deadlineTick: Number(e.target.value) })}
            />
          </label>
        </div>
        <fieldset>
          <legend>Predecessor jobs</legend>
          {Object.values(state.jobs)
            .filter(
              (j) => j.facilityId === facilityId && j.id !== job?.id && j.status !== 'cancelled',
            )
            .map((j) => (
              <label className="check-label" key={j.id}>
                <input
                  type="checkbox"
                  checked={draft.dependsOn.includes(j.id)}
                  onChange={(e) =>
                    patch({
                      dependsOn: e.target.checked
                        ? [...draft.dependsOn, j.id]
                        : draft.dependsOn.filter((id) => id !== j.id),
                    })
                  }
                />
                {j.id} · {j.status}
              </label>
            ))}
        </fieldset>
        <button type="submit" disabled={conflict}>
          {job ? 'Save job requirements' : 'Create job'}
        </button>
      </fieldset>
    </form>
  );
}
