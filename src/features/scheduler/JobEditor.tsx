import { useState } from 'react';
import type { DomainState } from '../../domain/model';
import type { JobInput, WarehouseJob } from '../../domain/jobs';
export function JobEditor({
  state,
  facilityId,
  job,
  pending,
  onSave,
}: {
  state: DomainState;
  facilityId: string;
  job?: WarehouseJob;
  pending: boolean;
  onSave: (input: JobInput) => void;
}) {
  const zones = Object.values(state.zones).filter(
    (z) => state.floors[z.floorId].facilityId === facilityId,
  );
  const [draft, setDraft] = useState<JobInput>(() =>
    job
      ? {
          title: job.title,
          facilityId: job.facilityId,
          sourceZoneId: job.sourceZoneId,
          destinationZoneId: job.destinationZoneId,
          payloadKg: job.payloadKg,
          units: job.units,
          priority: job.priority,
          deadlineTick: job.deadlineTick,
          dependsOn: [...job.dependsOn],
        }
      : {
          title: 'Dock transfer request',
          facilityId,
          sourceZoneId: zones[1]?.id ?? '',
          destinationZoneId: zones[4]?.id ?? '',
          payloadKg: 60,
          units: 4,
          priority: 3,
          deadlineTick: state.tick + 1800,
          dependsOn: [],
        },
  );
  const patch = (value: Partial<JobInput>) => setDraft({ ...draft, ...value });
  return (
    <form
      className="job-editor"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <h2>{job ? 'Job requirements' : 'New warehouse job'}</h2>
      <fieldset
        disabled={pending || (!!job && !['queued', 'partially-completed'].includes(job.status))}
      >
        <label>
          Job title
          <input required value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
        </label>
        <div className="form-pair">
          {(['sourceZoneId', 'destinationZoneId'] as const).map((field) => (
            <label key={field}>
              {field === 'sourceZoneId' ? 'Source station' : 'Destination station'}
              <select value={draft[field]} onChange={(e) => patch({ [field]: e.target.value })}>
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
              min="1"
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
        <button type="submit">{job ? 'Save job requirements' : 'Create job'}</button>
      </fieldset>
    </form>
  );
}
