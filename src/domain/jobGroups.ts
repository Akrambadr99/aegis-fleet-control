import type { DomainState, Versioned } from './model';
import { DomainError } from './errors';
import { assertDispatchOwnership } from './jobLocks';

export interface JobGroup extends Versioned {
  title: string;
  facilityId: string;
  jobIds: string[];
  status: 'ready' | 'held' | 'closed';
  createdBy: string;
  createdAt: number;
  changedBy: string;
  reason: string;
}
export type JobGroupCommand =
  | {
      type: 'job-group.create';
      id: string;
      expectedRevision: number;
      title: string;
      facilityId: string;
      jobs: { id: string; expectedRevision: number }[];
    }
  | {
      type: 'job-group.set';
      id: string;
      expectedRevision: number;
      status: JobGroup['status'];
      reason: string;
    };

export function applyJobGroup(state: DomainState, command: JobGroupCommand, actorId: string) {
  const existing = state.jobGroups[command.id];
  if ((existing?.revision ?? 0) !== command.expectedRevision)
    throw new DomainError('stale', 'Dispatch group changed; review its current state');
  if (command.type === 'job-group.create') {
    if (
      existing ||
      !command.id.trim() ||
      !command.title.trim() ||
      !state.facilities[command.facilityId]
    )
      throw new DomainError('invalid', 'A new group needs a unique identifier, title and facility');
    if (
      !command.jobs.length ||
      command.jobs.length > 50 ||
      new Set(command.jobs.map((job) => job.id)).size !== command.jobs.length
    )
      throw new DomainError('invalid', 'A dispatch group requires 1–50 distinct jobs');
    for (const target of command.jobs) {
      const job = state.jobs[target.id];
      if (!job || job.facilityId !== command.facilityId)
        throw new DomainError('invalid', 'Group jobs must belong to its facility');
      if (job.revision !== target.expectedRevision)
        throw new DomainError('stale', 'Job ' + job.id + ' changed before grouping');
      assertDispatchOwnership(job, actorId, state.tick);
      if (job.groupId || !['queued', 'partially-completed'].includes(job.status))
        throw new DomainError(
          'conflict',
          'Job ' + job.id + ' is already grouped or assigned',
          'scheduling',
        );
    }
    state.jobGroups[command.id] = {
      id: command.id,
      revision: 1,
      title: command.title.trim(),
      facilityId: command.facilityId,
      jobIds: command.jobs.map((job) => job.id),
      status: 'ready',
      createdBy: actorId,
      createdAt: state.tick,
      changedBy: actorId,
      reason: 'Group created',
    };
    for (const target of command.jobs) {
      state.jobs[target.id].groupId = command.id;
      state.jobs[target.id].revision++;
    }
    return;
  }
  if (!existing) throw new DomainError('missing', 'Dispatch group no longer exists');
  if (existing.status === 'closed')
    throw new DomainError('invalid', 'Closed dispatch groups cannot change');
  if (!['ready', 'held', 'closed'].includes(command.status) || !command.reason.trim())
    throw new DomainError('invalid', 'Choose a group state and provide a reason');
  if (command.status === existing.status)
    throw new DomainError('unchanged', 'Dispatch group already has this state');
  if (
    command.status === 'closed' &&
    existing.jobIds.some((id) => !['completed', 'cancelled'].includes(state.jobs[id].status))
  )
    throw new DomainError('invalid', 'Complete or cancel every job before closing its group');
  existing.status = command.status;
  existing.reason = command.reason;
  existing.changedBy = actorId;
  existing.revision++;
}
