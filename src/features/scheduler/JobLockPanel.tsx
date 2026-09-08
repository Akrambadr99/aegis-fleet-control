import { useState } from 'react';
import { useDomain, useFleet } from '../../app/FleetProvider';
import { useCommand } from '../../hooks/useCommand';
import type { WarehouseJob } from '../../domain/jobs';
import { ownsLease } from '../../domain/ownership';
import { facilityPermission } from '../../domain/permissions';

export function JobLockPanel({ job }: { job: WarehouseJob }) {
  const state = useDomain(),
    { actor } = useFleet(),
    { run, pending, message } = useCommand();
  const [duration, setDuration] = useState(120),
    [reason, setReason] = useState('');
  const lock = job.dispatchLock;
  const active = lock?.state === 'active' && lock.expiresAt > state.tick;
  const mine = ownsLease(lock, actor.id, state.tick);
  const unavailable =
    pending ||
    !!facilityPermission(actor, job.facilityId, 'dispatch-lock.acquire') ||
    ['completed', 'cancelled'].includes(job.status);
  const invalidDuration = !Number.isInteger(duration) || duration < 1 || duration > 300;
  const target = { id: job.id, expectedRevision: job.revision };
  return (
    <section className="job-lock-panel" aria-label="Dispatch ownership">
      <h3>Dispatch ownership</h3>
      <p>
        {active
          ? `${lock.ownerId} owns dispatch until tick ${lock.expiresAt}`
          : 'No active dispatcher lock'}
      </p>
      <fieldset disabled={unavailable}>
        <label>
          Lock duration seconds
          <input
            type="number"
            min="1"
            max="300"
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
          />
        </label>
        {!mine && (
          <label>
            Dispatch lock reason
            <input value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
        )}
        {!active && (
          <button
            disabled={invalidDuration || !reason.trim()}
            onClick={() => run({ ...target, type: 'dispatch-lock.acquire', duration, reason })}
          >
            Acquire dispatch lock
          </button>
        )}
        {mine && (
          <>
            <button
              disabled={invalidDuration}
              onClick={() => run({ ...target, type: 'dispatch-lock.renew', duration })}
            >
              Renew dispatch lock
            </button>
            <button onClick={() => run({ ...target, type: 'dispatch-lock.release' })}>
              Release dispatch lock
            </button>
          </>
        )}
        {active && !mine && actor.role === 'administrator' && (
          <button
            disabled={invalidDuration || !reason.trim()}
            onClick={() => run({ ...target, type: 'dispatch-lock.takeover', duration, reason })}
          >
            Take over dispatch lock
          </button>
        )}
      </fieldset>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
