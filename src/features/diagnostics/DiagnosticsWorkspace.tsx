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
  const eventBatches = useSyncExternalStore(
    gateway.events.subscribeState,
    gateway.events.getBatches,
    gateway.events.getBatches,
  );
  const eventDeliveryFailures = useSyncExternalStore(
    gateway.events.subscribeState,
    gateway.events.getDeliveryFailures,
    gateway.events.getDeliveryFailures,
  );
  const workers = useSyncExternalStore(
    gateway.workers.subscribe,
    gateway.workers.getSnapshot,
    gateway.workers.getSnapshot,
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
      <h2>Event delivery</h2>
      <p>
        Committed batches {eventBatches.length} · Events{' '}
        {eventBatches.reduce((count, batch) => count + batch.events.length, 0)} · Delivery failures{' '}
        {eventDeliveryFailures.length}
      </p>
      {eventDeliveryFailures.length > 0 && (
        <ol aria-label="Event delivery failures">
          {eventDeliveryFailures
            .slice(-10)
            .reverse()
            .map((failure, index) => (
              <li key={`${failure.revision}-${index}`}>
                Revision {failure.revision} · {failure.eventIds.join(', ')} · {failure.message}
              </li>
            ))}
        </ol>
      )}
      <h2>Background workers</h2>
      <ol aria-label="Background workers">
        {workers.map((worker) => (
          <li key={worker.id}>
            {worker.id} · {worker.state} · pending {worker.pendingBatches} · last revision{' '}
            {worker.lastProcessedRevision ?? 'none'}
            {worker.lastError ? ` · ${worker.lastError}` : ''}
            {worker.state === 'failed' && (
              <button type="button" onClick={() => gateway.workers.retry(worker.id)}>
                Retry {worker.id}
              </button>
            )}
          </li>
        ))}
      </ol>
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
