import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDomain, useFleet } from '../../app/FleetProvider';
import { inspectInvariants } from '../../domain/invariants';
export function DiagnosticsWorkspace() {
  const state = useDomain();
  const { gateway } = useFleet();
  const operations = useSyncExternalStore(
    gateway.requests.subscribe,
    gateway.requests.getOperations,
    gateway.requests.getOperations,
  );
  const queries = useQueryClient().getQueryCache();
  const [, refresh] = useState(0);
  useEffect(() => queries.subscribe(() => refresh((value) => value + 1)), [queries]);
  const violations = inspectInvariants(state);
  return (
    <section className="panel">
      <h1>Local diagnostics</h1>
      <p>
        Simulation tick {state.tick} · Revision {state.revision} · Pending commands{' '}
        {operations.filter((o) => o.status === 'pending').length}
      </p>
      <h2>Integrity</h2>
      <p>{violations.length ? JSON.stringify(violations) : 'All checked invariants hold'}</p>
      <h2>Query state</h2>
      <ul>
        {queries.getAll().map((query) => (
          <li key={query.queryHash}>
            {query.queryHash}: {query.state.status} / {query.state.fetchStatus}
          </li>
        ))}
      </ul>
      <h2>Recent operations</h2>
      <ol>
        {operations
          .slice(-30)
          .reverse()
          .map((operation) => (
            <li key={operation.operationId}>
              {operation.operationId} · {operation.entityId} · {operation.action} ·{' '}
              {operation.status} {operation.error}
            </li>
          ))}
      </ol>
      <h2>Event causality</h2>
      <ol>
        {state.activity
          .slice(-30)
          .reverse()
          .map((event) => (
            <li key={event.id}>
              {event.id}: {event.type} · caused by {event.causationId ?? 'historical/system event'}{' '}
              · correlation {event.correlationId ?? event.id}
            </li>
          ))}
      </ol>
    </section>
  );
}
