import { useSyncExternalStore } from 'react';
import { useFleet } from '../app/FleetProvider';
export function useOperation(entityId: string, action: string) {
  const { gateway } = useFleet();
  const records = useSyncExternalStore(
    gateway.requests.subscribe,
    gateway.requests.getOperations,
    gateway.requests.getOperations,
  );
  const matching = records.filter(
    (record) => record.entityId === entityId && record.action === action,
  );
  return {
    pending: matching.some((record) => record.status === 'pending'),
    latest: matching.at(-1),
  };
}
