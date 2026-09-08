import { useCollectionPage } from '../../hooks/useCollectionPage';
import { CollectionPager } from '../../components/CollectionPager';
import { getMissionExecutionProjection } from '../../application/projections';
import { OperationalAlerts } from '../../components/OperationalAlerts';
import { useScope } from '../../hooks/useWorkspaceScope';
import { AuditDetails } from './AuditDetails';
import { CommandButton } from '../../components/CommandButton';
import { missionFeasibility, simulationInputs } from '../../domain/selectors';
export function ChargingPanel() {
  const { state, floor, change } = useScope();
  return (
    <section className="charging-deck">
      <h2>Charger availability and queues</h2>
      <p className="workspace-note">
        Charger terminals · Reservation order and connected robot battery
      </p>
      {Object.values(state.chargers)
        .filter((charger) => charger.floorId === floor.id)
        .map((charger) => (
          <article className="charger-lane" key={charger.id}>
            <div className="charger-terminal">
              <h3>{charger.id}</h3>
              <p className={charger.available ? 'available' : 'overdue'}>
                {charger.available ? 'Available' : 'Out of service'}
              </p>
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
            </div>
            <ol className="charger-queue">
              {Object.values(state.reservations)
                .filter((reservation) => reservation.chargerId === charger.id)
                .sort((a, b) => a.queuePosition - b.queuePosition)
                .map((reservation) => (
                  <li key={reservation.id}>
                    <button
                      className="text-button"
                      onClick={() => change('robot', reservation.robotId)}
                    >
                      {reservation.robotId}
                    </button>
                    <span>{reservation.state}</span>
                    <small>
                      Battery {state.robots[reservation.robotId].battery.toFixed(1)}% ·{' '}
                      {reservation.id}
                    </small>
                  </li>
                ))}
            </ol>
            {!Object.values(state.reservations).some(
              (reservation) => reservation.chargerId === charger.id,
            ) && <p className="charger-queue-empty">No charger reservations.</p>}
          </article>
        ))}
    </section>
  );
}
export function FaultPanel() {
  const { state, facility, change } = useScope();
  const faults = Object.values(state.faults).filter(
    (f) => state.robots[f.robotId].facilityId === facility.id,
  );
  const page = useCollectionPage(faults, 'faultPage');
  return (
    <section className="fault-triage">
      <header>
        <h2>Active fault triage</h2>
        <CollectionPager page={page} label="Faults" />
      </header>
      {page.items.map((fault) => (
        <article className="fault-strip" data-severity={fault.severity} key={fault.id}>
          <div className="fault-identity">
            <h3>
              {fault.id} · {fault.severity}
            </h3>
            <button className="text-button" onClick={() => change('robot', fault.robotId)}>
              {fault.robotId}
            </button>
          </div>
          <div>
            <strong>{fault.message}</strong>
            <p>{fault.status} · Acknowledgement does not clear the recovery interlock.</p>
          </div>
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
      {!faults.length && <p>No recorded faults in this facility.</p>}
    </section>
  );
}
export function ExecutionPanel() {
  const { state, floor, change } = useScope();
  const missions = getMissionExecutionProjection(state, floor.id);
  return (
    <section className="execution-register">
      <h2>Mission execution state</h2>
      <p className="workspace-note">
        Live mission register · Route progress, remaining estimate and execution interlocks
      </p>
      {missions.map((mission) => {
        const robot = state.robots[mission.robotId],
          feasibility = missionFeasibility(state, mission.id);
        return (
          <article className="execution-row" key={mission.id}>
            <div>
              <h3>
                {mission.id} · {mission.status}
              </h3>
              <button className="text-button" onClick={() => change('robot', robot.id)}>
                {robot.id}
              </button>
            </div>
            <div className="execution-progress">
              <span>{mission.progress.toFixed(1)}% route</span>
              <progress max="100" value={mission.progress} aria-label={`${mission.id} progress`} />
              <small>
                {feasibility.etaSeconds} s · {feasibility.batteryRequired.toFixed(1)}% estimated
                battery
              </small>
            </div>
            <div
              className={
                mission.pauseReason || feasibility.reasons.length
                  ? 'execution-interlock'
                  : 'execution-readiness'
              }
            >
              <p>{mission.pauseReason ?? 'No execution block'}</p>
              <p>{feasibility.reasons.join('; ') || 'Mission feasible'}</p>
            </div>
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
  const related = new Set(
    state.replay.filter((frame) => frame.robotId === robot).map((frame) => frame.eventId),
  );
  const events = state.activity
    .filter((event) => !robot || event.entityId === robot || related.has(event.id))
    .slice()
    .reverse();
  const page = useCollectionPage(events, 'activityPage', 50);
  return (
    <section className="panel">
      <h2>Operator and system activity</h2>
      <CollectionPager page={page} label="Activity" />
      <OperationalAlerts />
      <ol className="record-list">
        {page.items.map((event) => (
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
