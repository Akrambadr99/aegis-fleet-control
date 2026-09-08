import type { Actor, DomainState } from './model';
import type { WarehouseJob } from './jobs';
import { ownsLease, renewLease, type OwnershipLease } from './ownership';
import { DomainError } from './errors';

export interface JobDispatchLock extends OwnershipLease {
  reason: string;
}
export type JobLockCommand =
  | {
      type: 'dispatch-lock.acquire';
      id: string;
      expectedRevision: number;
      duration: number;
      reason: string;
    }
  | { type: 'dispatch-lock.renew'; id: string; expectedRevision: number; duration: number }
  | { type: 'dispatch-lock.release'; id: string; expectedRevision: number }
  | {
      type: 'dispatch-lock.takeover';
      id: string;
      expectedRevision: number;
      duration: number;
      reason: string;
    };
export function dispatchLockConflict(
  job: WarehouseJob,
  ownerId: string,
  tick: number,
): string | null {
  const lock = job.dispatchLock;
  return lock?.state === 'active' && lock.expiresAt > tick && lock.ownerId !== ownerId
    ? 'Dispatch owned by ' + lock.ownerId + ' until tick ' + lock.expiresAt
    : null;
}
export function assertDispatchOwnership(job: WarehouseJob, actorId: string, tick: number) {
  const conflict = dispatchLockConflict(job, actorId, tick);
  if (conflict) throw new DomainError('conflict', conflict, 'ownership');
}
export function applyJobLock(state: DomainState, actor: Actor, command: JobLockCommand) {
  const job = state.jobs[command.id];
  if (!job) throw new DomainError('missing', 'Job no longer exists');
  if (job.revision !== command.expectedRevision)
    throw new DomainError('stale', 'Job changed; review its dispatch ownership');
  if (['completed', 'cancelled'].includes(job.status))
    throw new DomainError('invalid', 'Closed jobs cannot acquire dispatch ownership');
  const active = job.dispatchLock?.state === 'active' && job.dispatchLock.expiresAt > state.tick;
  if (command.type === 'dispatch-lock.release' || command.type === 'dispatch-lock.renew') {
    if (!ownsLease(job.dispatchLock, actor.id, state.tick))
      throw new DomainError(
        'conflict',
        'Only the current dispatcher can renew or release this lock',
        'ownership',
      );
    if (command.type === 'dispatch-lock.renew')
      job.dispatchLock = {
        ...job.dispatchLock!,
        ...renewLease(job.dispatchLock!, actor.id, state.tick, command.duration),
      };
    else
      job.dispatchLock = { ...job.dispatchLock!, state: 'released', reason: 'Released by owner' };
  } else {
    if (
      !Number.isInteger(command.duration) ||
      command.duration < 1 ||
      command.duration > 300 ||
      !command.reason.trim()
    )
      throw new DomainError('invalid', 'Provide a reason and a 1–300 second dispatch lock');
    if (command.type === 'dispatch-lock.takeover') {
      if (actor.role !== 'administrator')
        throw new DomainError('forbidden', 'Only administrators can take over dispatch ownership');
      if (!active || job.dispatchLock?.ownerId === actor.id)
        throw new DomainError('invalid', 'Takeover requires another active dispatcher');
    } else if (active)
      throw new DomainError('conflict', 'Dispatch ownership is already acquired', 'ownership');
    job.dispatchLock = {
      ownerId: actor.id,
      acquiredAt: state.tick,
      expiresAt: state.tick + command.duration,
      state: 'active',
      reason: command.reason,
    };
  }
  job.revision++;
}
export function expireDispatchLocks(
  state: DomainState,
): { job: WarehouseJob; previous: WarehouseJob }[] {
  const expired: { job: WarehouseJob; previous: WarehouseJob }[] = [];
  for (const job of Object.values(state.jobs)) {
    if (job.dispatchLock?.state === 'active' && job.dispatchLock.expiresAt <= state.tick) {
      const previous = structuredClone(job);
      job.dispatchLock.state = 'released';
      job.dispatchLock.reason = 'Dispatch lock expired';
      job.revision++;
      expired.push({ job, previous });
    }
  }
  return expired;
}
