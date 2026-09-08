import type { Actor, Command } from '../domain/model';
import type { OperationResult } from './operations';
import { DomainError } from '../domain/errors';

export type JobAssignment = Extract<Command, { type: 'job.assign' }>;
export type DispatchOutcome =
  | { jobId: string; status: 'confirmed'; result: OperationResult }
  | { jobId: string; status: 'failed'; code: string; message: string };
export interface DispatchReport {
  outcomes: DispatchOutcome[];
  confirmed: number;
  failed: number;
}
export async function dispatchJobs(
  actor: Actor,
  commands: readonly JobAssignment[],
  execute: (actor: Actor, command: JobAssignment) => Promise<OperationResult>,
): Promise<DispatchReport> {
  if (
    !commands.length ||
    commands.length > 50 ||
    new Set(commands.map((command) => command.id)).size !== commands.length
  )
    throw new DomainError('invalid', 'Choose 1–50 distinct jobs for a dispatch batch');
  // Capture all intents before any completion can change canonical job revisions.
  const captured = structuredClone(commands),
    identity = structuredClone(actor);
  const outcomes: DispatchOutcome[] = await Promise.all(
    captured.map(async (command): Promise<DispatchOutcome> => {
      try {
        return {
          jobId: command.id,
          status: 'confirmed',
          result: await execute(identity, { ...command, onlyUnassigned: true }),
        };
      } catch (error) {
        return {
          jobId: command.id,
          status: 'failed',
          code: error instanceof DomainError ? error.code : 'unknown',
          message: error instanceof Error ? error.message : 'Dispatch failed',
        };
      }
    }),
  );
  return {
    outcomes,
    confirmed: outcomes.filter((outcome) => outcome.status === 'confirmed').length,
    failed: outcomes.filter((outcome) => outcome.status === 'failed').length,
  };
}
