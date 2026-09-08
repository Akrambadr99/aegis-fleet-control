import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDomain, useFleet } from '../../app/FleetProvider';
import { useCommand } from '../../hooks/useCommand';
import type { JobGroup } from '../../domain/jobGroups';
import { facilityPermission } from '../../domain/permissions';

function JobGroupRow({ group, select }: { group: JobGroup; select: (ids: string[]) => void }) {
  const state = useDomain(),
    { actor } = useFleet(),
    { run, pending, message } = useCommand();
  const [reason, setReason] = useState('');
  const [, setParams] = useSearchParams();
  const members = group.jobIds.map((id) => state.jobs[id]);
  const complete = members.every((job) => ['completed', 'cancelled'].includes(job.status));
  const denied = facilityPermission(actor, group.facilityId, 'job-group.set');
  return (
    <article className="dispatch-group" aria-label={'Dispatch group ' + group.title}>
      <header>
        <strong>{group.title}</strong>
        <span>
          {group.status} · {members.length} jobs ·{' '}
          {members.reduce((sum, job) => sum + job.completedUnits, 0)} completed units
        </span>
      </header>
      <button
        onClick={() => {
          setParams((previous) => {
            const next = new URLSearchParams(previous);
            next.set('jobGroup', group.id);
            next.delete('jobPage');
            return next;
          });
        }}
      >
        View group jobs
      </button>
      <button
        onClick={() =>
          select(
            members
              .filter((job) => ['queued', 'partially-completed'].includes(job.status))
              .map((job) => job.id),
          )
        }
      >
        Select queued group jobs
      </button>
      {group.status !== 'closed' && (
        <fieldset disabled={pending || !!denied}>
          <label>
            Group decision reason
            <input value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <button
            disabled={!reason.trim()}
            onClick={() =>
              run({
                type: 'job-group.set',
                id: group.id,
                expectedRevision: group.revision,
                status: group.status === 'held' ? 'ready' : 'held',
                reason,
              })
            }
          >
            {group.status === 'held' ? 'Release group' : 'Hold group'}
          </button>
          <button
            disabled={!complete || !reason.trim()}
            onClick={() =>
              run({
                type: 'job-group.set',
                id: group.id,
                expectedRevision: group.revision,
                status: 'closed',
                reason,
              })
            }
          >
            Close group
          </button>
        </fieldset>
      )}
      <small>
        {group.changedBy}: {group.reason}
      </small>
      {message && <p role="status">{message}</p>}
    </article>
  );
}
export function JobGroupsPanel({
  facilityId,
  selectedIds,
  select,
}: {
  facilityId: string;
  selectedIds: string[];
  select: (ids: string[]) => void;
}) {
  const state = useDomain(),
    { actor } = useFleet(),
    { run, pending, message } = useCommand();
  const [title, setTitle] = useState('');
  const groups = Object.values(state.jobGroups).filter((group) => group.facilityId === facilityId);
  const denied = facilityPermission(actor, facilityId, 'job-group.create');
  const eligible =
    selectedIds.length > 0 &&
    selectedIds.length <= 50 &&
    selectedIds.every((id) => {
      const job = state.jobs[id];
      return (
        job &&
        !job.groupId &&
        job.facilityId === facilityId &&
        ['queued', 'partially-completed'].includes(job.status)
      );
    });
  return (
    <details className="job-groups-panel">
      <summary>Dispatch groups · {groups.length}</summary>
      <p>
        Group selected jobs for a shared dispatch hold. Running missions continue when a group is
        held.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!eligible || pending || denied) return;
          void run({
            type: 'job-group.create',
            id: 'GROUP-' + crypto.randomUUID(),
            expectedRevision: 0,
            title,
            facilityId,
            jobs: selectedIds.map((id) => ({ id, expectedRevision: state.jobs[id].revision })),
          });
        }}
      >
        <label>
          Dispatch group title
          <input required value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <button disabled={!eligible || pending || !!denied || !title.trim()}>
          Group selected jobs
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      {groups.map((group) => (
        <JobGroupRow key={group.id} group={group} select={select} />
      ))}
    </details>
  );
}
