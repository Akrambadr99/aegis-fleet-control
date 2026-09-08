import { useScope } from './useScope';
import { AuditDetails } from './AuditDetails';
import { CommandButton } from '../../components/CommandButton';
import { missionFeasibility, simulationInputs } from '../../domain/selectors';
export function ChargingPanel() {
  const { state, floor, change } = useScope();
  return (
    <section className="panel">
      <h2>Charger availability and queues</h2>
      <div className="resource-grid">
        {Object.values(state.chargers)
          .filter((c) => c.floorId === floor.id)
          .map((charger) => (
            <article className="resource" key={charger.id}>
              <h3>{charger.id}</h3>
              <p>{charger.available ? 'Available' : 'Out of service'}</p>
              <CommandButton
                command={{
                  type: 'charger.set',
                  id: charger.id,
                  expectedRevision: charger.revision,
                  available: !charger.available,
                }}
              >
                {charger.available ? 'Disable' : 'Enable'} {charger.id}
              </CommandButton>
              <ol>
                {Object.values(state.reservations)
                  .filter((r) => r.chargerId === charger.id)
                  .sort((a, b) => a.queuePosition - b.queuePosition)
                  .map((reservation) => (
                    <li key={reservation.id}>
                      <button
                        className="text-button"
                        onClick={() => change('robot', reservation.robotId)}
                      >
                        {reservation.robotId}
                      </button>{' '}
                      · {reservation.state}
                    </li>
                  ))}
              </ol>
            </article>
          ))}
      </div>
    </section>
  );
}
export function FaultPanel() {
  const { state, facility, change } = useScope();
  const faults = Object.values(state.faults).filter(
    (f) => state.robots[f.robotId].facilityId === facility.id,
  );
  return (
    <section className="panel">
      <h2>Active fault triage</h2>
      {faults.map((fault) => (
        <article className="resource" key={fault.id}>
          <h3>
            {fault.id} · {fault.severity}
          </h3>
          <p>
            {fault.message} · {fault.status}
          </p>
          <button className="text-button" onClick={() => change('robot', fault.robotId)}>
            {fault.robotId}
          </button>
          {fault.status === 'active' ? (
            <CommandButton
              command={{
                type: 'fault.acknowledge',
                id: fault.id,
                expectedRevision: fault.revision,
              }}
            >
              Acknowledge {fault.id}
            </CommandButton>
          ) : (
            <p>Acknowledged by {fault.acknowledgedBy}. Recovery remains required.</p>
          )}
        </article>
      ))}
    </section>
  );
}
export function ExecutionPanel() {
  const { state, floor, change } = useScope();
  const missions = Object.values(state.robots)
    .filter((r) => r.floorId === floor.id && r.activeMissionId)
    .map((r) => state.missions[r.activeMissionId!]);
  return (
    <section className="panel">
      <h2>Mission execution state</h2>
      {missions.map((mission) => {
        const robot = state.robots[mission.robotId],
          feasibility = missionFeasibility(state, mission.id);
        return (
          <article className="resource" key={mission.id}>
            <h3>
              {mission.id} · {mission.status}
            </h3>
            <button className="text-button" onClick={() => change('robot', robot.id)}>
              {robot.id}
            </button>
            <progress max="100" value={mission.progress} aria-label={`${mission.id} progress`} />
            <p>
              {mission.pauseReason ?? 'No execution block'} · {feasibility.etaSeconds} s ·{' '}
              {feasibility.batteryRequired.toFixed(1)}% estimated battery
            </p>
            <p>{feasibility.reasons.join('; ') || 'Mission feasible'}</p>
            {(robot.status === 'running' || robot.status === 'paused') && (
              <CommandButton
                command={{
                  type: robot.status === 'running' ? 'robot.pause' : 'robot.resume',
                  id: robot.id,
                  expectedRevision: robot.revision,
                }}
              >
                {robot.status === 'running' ? 'Pause' : 'Resume'} {mission.id}
              </CommandButton>
            )}
          </article>
        );
      })}
    </section>
  );
}
export function ActivityPanel() {
  const { state, params } = useScope();
  const robot = params.get('robot');
  return (
    <section className="panel">
      <h2>Operator and system activity</h2>
      <ol className="record-list">
        {state.activity
          .filter(
            (e) =>
              !robot ||
              e.entityId === robot ||
              state.replay.some((frame) => frame.eventId === e.id && frame.robotId === robot),
          )
          .slice(-50)
          .reverse()
          .map((event) => (
            <li key={event.id}>
              <strong>{event.type}</strong> · {event.entityId} · {event.actorId}
              <p>{event.details}</p>
              <AuditDetails event={event} />
            </li>
          ))}
      </ol>
    </section>
  );
}
export function SimulationPanel() {
  const { state, facility } = useScope();
  const inputs = simulationInputs(state, facility.id);
  return (
    <section className="panel">
      <h2>Live scenario inputs</h2>
      <p>
        These inputs derive from the operating facility. Comparative scenario execution is a later
        milestone.
      </p>
      <dl>
        <div>
          <dt>Robots</dt>
          <dd>{inputs.robotCount}</dd>
        </div>
        <div>
          <dt>Available chargers</dt>
          <dd>{inputs.availableChargers}</dd>
        </div>
        <div>
          <dt>Topology revision</dt>
          <dd>{inputs.topologyRevision}</dd>
        </div>
        <div>
          <dt>Disabled corridors</dt>
          <dd>{inputs.closedCorridors.join(', ') || 'None'}</dd>
        </div>
      </dl>
    </section>
  );
}
export function TelemetryPanel() {
  const { state, floor, params } = useScope();
  const robot = params.get('robot');
  const robots = Object.values(state.robots).filter(
    (r) => r.floorId === floor.id && (!robot || r.id === robot),
  );
  return (
    <section className="panel">
      <h2>Deterministic telemetry</h2>
      <p>Use Advance simulation to move the clock by one second.</p>
      {robots.map((r) => (
        <article key={r.id} className="resource">
          <h3>
            {r.id} · {r.status}
          </h3>
          <p>
            Battery {r.battery.toFixed(1)}% · Position {r.position.x}, {r.position.y}
          </p>
          <svg viewBox="0 0 300 60" role="img" aria-label={`${r.id} battery history`}>
            <polyline
              fill="none"
              stroke="#258375"
              strokeWidth="2"
              points={state.telemetry
                .filter((t) => t.robotId === r.id)
                .slice(-30)
                .map((t, i) => `${i * 10},${60 - t.battery * 0.6}`)
                .join(' ')}
            />
          </svg>
        </article>
      ))}
    </section>
  );
}
