import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { useFleet } from '../../app/FleetProvider';
import {
  dispatchJobs,
  type DispatchReport,
  type JobAssignment,
} from '../../application/jobDispatch';
import type { Actor } from '../../domain/model';

interface DispatchIntent {
  commands: JobAssignment[];
  actor: Actor;
  cancellation: AbortController;
}
export function useJobDispatch(facilityId: string) {
  const { gateway, actor } = useFleet(),
    client = useQueryClient();
  const mutationKey = ['warehouse-dispatch', facilityId];
  const mutation = useMutation<DispatchReport, Error, DispatchIntent>({
    mutationKey,
    gcTime: 30 * 60 * 1000,
    retry: false,
    mutationFn: ({ actor: capturedActor, commands, cancellation }) =>
      dispatchJobs(
        capturedActor,
        commands,
        (identity, command) => gateway.command(identity, command, cancellation.signal).promise,
      ),
  });
  const runs = useMutationState({
    filters: { mutationKey, exact: true },
    select: (entry) => ({
      id: entry.mutationId,
      status: entry.state.status,
      intent: entry.state.variables as DispatchIntent,
      report: entry.state.data as DispatchReport | undefined,
      error: entry.state.error as Error | null,
    }),
  });
  function dispatch(commands: JobAssignment[]) {
    if (client.isMutating({ mutationKey, exact: true })) return;
    mutation.mutate({
      commands: structuredClone(commands),
      actor: structuredClone(actor),
      cancellation: new AbortController(),
    });
  }
  return { dispatch, runs: runs.slice(-5), pending: runs.some((run) => run.status === 'pending') };
}
