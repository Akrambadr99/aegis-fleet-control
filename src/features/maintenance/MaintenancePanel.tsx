import { useCollectionPage } from '../../hooks/useCollectionPage';
import { CollectionPager } from '../../components/CollectionPager';
import { useScope } from '../../hooks/useWorkspaceScope';
import { CommandButton } from '../../components/CommandButton';

const stages = ['scheduled', 'in-progress', 'verification', 'completed'] as const;
const stageLabels = {
  scheduled: 'Scheduled',
  'in-progress': 'In service',
  verification: 'Verification',
  completed: 'Released',
};
export function MaintenancePanel() {
  const { state, floor, params, change } = useScope();
  const orders = Object.values(state.maintenance)
    .filter((order) => state.robots[order.robotId].floorId === floor.id)
    .sort((a, b) => stages.indexOf(a.status) - stages.indexOf(b.status) || a.dueTick - b.dueTick);
  const page = useCollectionPage(orders, 'maintenancePage');
  const selected = orders.find((order) => order.robotId === params.get('robot'));
  return (
    <section className="service-register" aria-label="Maintenance service queue">
      <header className="service-register-header">
        <div>
          <h2>Service workboard</h2>
          <p>{floor.name} · Service orders and return-to-operation verification</p>
        </div>
        <CollectionPager page={page} label="Maintenance" />
      </header>
      <ol className="service-sequence" aria-label="Service lifecycle">
        {stages.map((status) => (
          <li key={status}>
            <span>{stageLabels[status]}</span>
            <strong>{orders.filter((order) => order.status === status).length}</strong>
          </li>
        ))}
      </ol>
      <div className="table-scroll">
        <table className="service-table">
          <caption className="sr-only">Service orders for {floor.name}</caption>
          <thead>
            <tr>
              <th>Order / robot</th>
              <th>Service state</th>
              <th>Due</th>
              <th>Technician</th>
              <th>Operational hold</th>
              <th>Next service action</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((order) => {
              const robot = state.robots[order.robotId];
              const overdue = order.status !== 'completed' && order.dueTick <= state.tick;
              return (
                <tr
                  key={order.id}
                  className={selected?.id === order.id ? 'selected-row' : undefined}
                >
                  <td>
                    <button className="text-button" onClick={() => change('robot', order.robotId)}>
                      {order.robotId}
                    </button>
                    <small>{order.id}</small>
                  </td>
                  <td>
                    <span className={`service-state service-state-${order.status}`}>
                      {stageLabels[order.status]}
                    </span>
                  </td>
                  <td className={overdue ? 'overdue' : undefined}>
                    {overdue ? 'Overdue · ' : ''}tick {order.dueTick}
                  </td>
                  <td>{order.technician}</td>
                  <td>
                    {robot.status}
                    <small>{robot.activeMissionId ?? 'No active mission'}</small>
                  </td>
                  <td>
                    {order.status === 'completed' ? (
                      <span>Service verified</span>
                    ) : (
                      <CommandButton
                        command={{
                          type:
                            order.status === 'scheduled'
                              ? 'maintenance.start'
                              : order.status === 'in-progress'
                                ? 'maintenance.verify'
                                : 'maintenance.complete',
                          id: order.id,
                          expectedRevision: order.revision,
                        }}
                      >
                        {order.status === 'scheduled'
                          ? 'Start service'
                          : order.status === 'in-progress'
                            ? 'Send for verification'
                            : 'Complete service'}{' '}
                        {order.robotId}
                      </CommandButton>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!orders.length && <p className="service-empty">No service orders on this floor.</p>}
      <footer className="service-context">
        <strong>
          {selected
            ? `${selected.id} · ${selected.robotId}`
            : 'Select a robot to inspect its service context'}
        </strong>
        <p>
          Starting service pauses active execution and releases route and charger reservations.
          Verification is required before service can be completed.
        </p>
        {selected && (
          <span>
            Current gate: {stageLabels[selected.status]} · Order revision {selected.revision}
          </span>
        )}
      </footer>
    </section>
  );
}
