import { useScope } from '../../hooks/useWorkspaceScope';
import { CommandButton } from '../../components/CommandButton';
export function MaintenancePanel() {
  const { state, floor, change } = useScope();
  const orders = Object.values(state.maintenance).filter(
    (order) => state.robots[order.robotId].floorId === floor.id,
  );
  return (
    <section className="panel">
      <h2>Service workboard</h2>
      <p>Start service, perform inspection, then verify before returning a robot to operations.</p>
      <div className="service-board">
        {(['scheduled', 'in-progress', 'verification', 'completed'] as const).map((status) => (
          <section key={status}>
            <h3>{status}</h3>
            {orders
              .filter((order) => order.status === status)
              .map((order) => (
                <article className="resource" key={order.id}>
                  <button className="text-button" onClick={() => change('robot', order.robotId)}>
                    {order.robotId}
                  </button>
                  <p>
                    Due tick {order.dueTick} · {order.technician}
                  </p>
                  {status !== 'completed' && (
                    <CommandButton
                      command={{
                        type:
                          status === 'scheduled'
                            ? 'maintenance.start'
                            : status === 'in-progress'
                              ? 'maintenance.verify'
                              : 'maintenance.complete',
                        id: order.id,
                        expectedRevision: order.revision,
                      }}
                    >
                      {status === 'scheduled'
                        ? 'Start service'
                        : status === 'in-progress'
                          ? 'Send for verification'
                          : 'Complete service'}{' '}
                      {order.robotId}
                    </CommandButton>
                  )}
                </article>
              ))}
          </section>
        ))}
      </div>
    </section>
  );
}
