import { useDomain, useFleet } from '../app/FleetProvider';
import { getOperationalNotifications } from '../application/projections';
export function OperationalAlerts() {
  const state = useDomain();
  const { actor } = useFleet();
  const alerts = getOperationalNotifications(state, actor);
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
