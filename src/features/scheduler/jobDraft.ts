import type { JobInput, WarehouseJob } from '../../domain/jobs';

export interface JobDraftSession {
  baseline: JobInput;
  draft: JobInput;
  baselineRevision: number;
  observedRevision: number;
}
export function jobInputSnapshot(job: WarehouseJob): JobInput {
  return {
    title: job.title,
    kind: job.kind ?? 'transport',
    requiredActions: [...(job.requiredActions ?? [])],
    facilityId: job.facilityId,
    sourceZoneId: job.sourceZoneId,
    destinationZoneId: job.destinationZoneId,
    payloadKg: job.payloadKg,
    units: job.units,
    priority: job.priority,
    deadlineTick: job.deadlineTick,
    dependsOn: [...job.dependsOn],
  };
}
export function changedJobFields(before: JobInput, after: JobInput): (keyof JobInput)[] {
  return (Object.keys(before) as (keyof JobInput)[]).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}
export function newJobDraft(input: JobInput, revision: number): JobDraftSession {
  return {
    baseline: structuredClone(input),
    draft: structuredClone(input),
    baselineRevision: revision,
    observedRevision: revision,
  };
}
export function reconcileJobDraft(
  session: JobDraftSession,
  input: JobInput,
  revision: number,
): JobDraftSession {
  if (revision === session.observedRevision) return session;
  if (!changedJobFields(session.baseline, input).length)
    return { ...session, baselineRevision: revision, observedRevision: revision };
  if (
    !changedJobFields(session.baseline, session.draft).length ||
    !changedJobFields(session.draft, input).length
  )
    return newJobDraft(input, revision);
  return { ...session, observedRevision: revision };
}
export function rebaseJobDraft(
  session: JobDraftSession,
  input: JobInput,
  revision: number,
): JobDraftSession {
  const edited = Object.fromEntries(
    changedJobFields(session.baseline, session.draft).map((key) => [key, session.draft[key]]),
  );
  return { ...newJobDraft(input, revision), draft: structuredClone({ ...input, ...edited }) };
}
export const jobFieldLabels: Record<keyof JobInput, string> = {
  title: 'Title',
  kind: 'Job kind',
  requiredActions: 'Capabilities',
  facilityId: 'Facility',
  sourceZoneId: 'Source station',
  destinationZoneId: 'Destination station',
  payloadKg: 'Payload',
  units: 'Quantity',
  priority: 'Priority',
  deadlineTick: 'Deadline',
  dependsOn: 'Predecessors',
};
