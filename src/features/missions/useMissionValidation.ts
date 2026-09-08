import { useEffect, useState } from 'react';
import type { Actor } from '../../domain/model';
import type { MissionPlan, PlanValidation } from '../../domain/planning';
import type { FleetGateway } from '../../gateway/FleetGateway';

export function useMissionValidation(
  gateway: FleetGateway,
  plan: MissionPlan,
  stateRevision: number,
  actor: Actor,
) {
  const [attempt, setAttempt] = useState(0);
  const actorKey = JSON.stringify(actor);
  const key = JSON.stringify([plan, stateRevision, actorKey, attempt]);
  const [completion, setCompletion] = useState<{
    key: string;
    result?: PlanValidation;
    error?: string;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    gateway
      .validateMissionPlan(plan, controller.signal, JSON.parse(actorKey) as Actor)
      .promise.then((result) => {
        if (active && !controller.signal.aborted) setCompletion({ key, result });
      })
      .catch((error) => {
        if (active && !controller.signal.aborted)
          setCompletion({
            key,
            error: error instanceof Error ? error.message : 'Validation failed',
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [gateway, plan, actorKey, key]);
  const current = completion?.key === key;
  return {
    current,
    result: current ? completion.result : undefined,
    error: current ? completion.error : undefined,
    retry: () => setAttempt((value) => value + 1),
  };
}
