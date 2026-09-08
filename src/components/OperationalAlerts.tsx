import { useSyncExternalStore } from 'react';
import { useFleet } from '../app/FleetProvider';
export function OperationalAlerts() {
  const { actor, gateway } = useFleet();
  useSyncExternalStore(
    gateway.alerts.subscribe,
    gateway.alerts.getSnapshot,
    gateway.alerts.getSnapshot,
  );
  const alerts = gateway.alerts.forActor(actor);
  return (
    <section aria-label="Operational alerts">
      <h2>Operational alerts</h2>
      {!alerts.length && <p>No recent alerts in your scope.</p>}
      <ul>
        {alerts.map((alert) => (
          <li key={alert.id}>
            <strong>
              {alert.severity}: {alert.entityId}
            </strong>{' '}
            {alert.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
