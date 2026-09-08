import type { RobotAction } from './capabilities';
import type { MissionStep } from './planning';
import { newStep } from './planning';

export const jobKinds = [
  'transport',
  'replenishment',
  'retrieval',
  'staging',
  'inspection',
  'relocation',
  'support',
] as const;
export type JobKind = (typeof jobKinds)[number];
export const jobProfiles: Record<
  JobKind,
  { label: string; cargo: boolean; source: string; destination: string; actions: RobotAction[] }
> = {
  transport: {
    label: 'Transport',
    cargo: true,
    source: 'Collect payload',
    destination: 'Deliver payload',
    actions: ['navigate', 'lift'],
  },
  replenishment: {
    label: 'Replenishment',
    cargo: true,
    source: 'Collect replenishment stock',
    destination: 'Replenish workstation',
    actions: ['navigate', 'lift'],
  },
  retrieval: {
    label: 'Retrieval',
    cargo: true,
    source: 'Retrieve stored payload',
    destination: 'Deliver retrieved stock',
    actions: ['navigate', 'lift'],
  },
  staging: {
    label: 'Staging',
    cargo: true,
    source: 'Collect outbound payload',
    destination: 'Stage outbound payload',
    actions: ['navigate', 'lift'],
  },
  inspection: {
    label: 'Inspection',
    cargo: false,
    source: 'Inspection starting point',
    destination: 'Inspect destination',
    actions: ['navigate', 'inspect'],
  },
  relocation: {
    label: 'Relocation',
    cargo: true,
    source: 'Collect inventory for relocation',
    destination: 'Relocate inventory',
    actions: ['navigate', 'lift'],
  },
  support: {
    label: 'Support',
    cargo: false,
    source: 'Support starting point',
    destination: 'Reach support station',
    actions: ['navigate'],
  },
};
export interface JobRequirements {
  kind?: JobKind;
  requiredActions?: RobotAction[];
  sourceZoneId: string;
  destinationZoneId: string;
  payloadKg: number;
}
export function jobActions(job: JobRequirements): RobotAction[] {
  return [
    ...new Set([...jobProfiles[job.kind ?? 'transport'].actions, ...(job.requiredActions ?? [])]),
  ];
}
export function jobSteps(job: JobRequirements): MissionStep[] {
  const profile = jobProfiles[job.kind ?? 'transport'];
  const steps: MissionStep[] = [
    { ...newStep('source'), zoneId: job.sourceZoneId, label: profile.source, payloadKg: 0 },
  ];
  if (profile.cargo)
    steps.push({
      ...newStep('pickup', 'pickup'),
      payloadKg: job.payloadKg,
      dependsOn: ['source'],
      label: profile.source,
    });
  steps.push({
    ...newStep('destination'),
    zoneId: job.destinationZoneId,
    dependsOn: [steps.at(-1)!.id],
    label: profile.destination,
    payloadKg: 0,
  });
  if (profile.cargo)
    steps.push({
      ...newStep('dropoff', 'dropoff'),
      payloadKg: job.payloadKg,
      dependsOn: ['destination'],
      label: profile.destination,
    });
  if (jobActions(job).includes('inspect'))
    steps.push({
      ...newStep('inspection', 'inspect'),
      zoneId: job.destinationZoneId,
      dependsOn: [steps.at(-1)!.id],
      payloadKg: 0,
      label: 'Inspect destination',
    });
  return steps;
}
