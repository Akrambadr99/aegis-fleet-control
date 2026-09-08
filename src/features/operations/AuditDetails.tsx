import type { Activity } from '../../domain/model';
export function AuditDetails({ event }: { event: Activity }) {
  if (!event.changes) return null;
  return (
    <details>
      <summary>Inspect changes ({event.changes.length})</summary>
      <p>
        {event.timestamp} · {event.actorRole} · {event.reason}
      </p>
      {event.changes.map((change) => (
        <section key={change.kind + change.entityId} className="audit-change">
          <h4>
            {change.kind} / {change.entityId}
          </h4>
          <div>
            <div>
              <strong>Before</strong>
              <pre>{JSON.stringify(change.previous, null, 2)}</pre>
            </div>
            <div>
              <strong>After</strong>
              <pre>{JSON.stringify(change.next, null, 2)}</pre>
            </div>
          </div>
        </section>
      ))}
    </details>
  );
}
