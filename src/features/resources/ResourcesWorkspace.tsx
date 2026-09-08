import { useState } from 'react';
import { useScope } from '../../hooks/useWorkspaceScope';
import { useFleet } from '../../app/FleetProvider';
import { resourceOwners } from '../../domain/resources';
import { ResourceQueue } from './ResourceQueue';
import { useCommand } from '../../hooks/useCommand';
import { commandPermission } from '../../domain/permissions';
export function ResourcesWorkspace() {
  const { state, floor, facility, change, params } = useScope(),
    { gateway, actor } = useFleet(),
    { run, pending, message } = useCommand();
  const resources = Object.values(state.resources).filter((r) => r.floorId === floor.id),
    resource = resources.find((r) => r.id === params.get('resource')) ?? resources[0];
  const [selectedRobot, setSelectedRobot] = useState('R-004'),
    [duration, setDuration] = useState(100),
    [priority, setPriority] = useState(3);
  const robots = Object.values(state.robots).filter((r) => r.floorId === floor.id),
    robot = robots.find((r) => r.id === selectedRobot) ?? robots[0];
  const command = {
    type: 'resource.request' as const,
    id: resource.id,
    expectedRevision: resource.revision,
    robotId: robot.id,
    priority,
    duration,
  };
  const denied = commandPermission(state, actor, command);
  return (
    <div className="resources-workspace">
      <header className="editor-header">
        <div>
          <p className="eyebrow">FACILITY ARBITRATION</p>
          <h1>Resource control</h1>
          <span>
            {facility.name} · {floor.name} · Tick {state.tick}
          </span>
        </div>
        <div className="editor-actions">
          <select
            aria-label="Resource facility"
            value={facility.id}
            onChange={(e) => change('facility', e.target.value)}
          >
            {Object.values(state.facilities).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Resource floor"
            value={floor.id}
            onChange={(e) => change('floor', e.target.value)}
          >
            {facility.floorIds.map((id) => (
              <option value={id} key={id}>
                {state.floors[id].name}
              </option>
            ))}
          </select>
          <button onClick={() => gateway.advance(10)}>Advance 10 seconds</button>
        </div>
      </header>
      <div className="resource-control-grid">
        <section>
          <h2>Shared facility resources</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>State</th>
                  <th>Owner</th>
                  <th>Waiting</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <tr key={r.id} className={resource.id === r.id ? 'selected-row' : ''}>
                    <td>
                      <button className="text-button" onClick={() => change('resource', r.id)}>
                        {r.id}
                      </button>
                      <small>{r.kind}</small>
                    </td>
                    <td>{r.available ? 'Available' : 'Out of service'}</td>
                    <td>
                      {resourceOwners(state, r.id)
                        .map((lease) => lease.robotId)
                        .join(', ') || '—'}
                    </td>
                    <td>
                      {
                        Object.values(state.resourceReservations).filter(
                          (l) => l.resourceId === r.id && l.state === 'queued',
                        ).length
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section className="resource-request">
            <h2>Request ownership</h2>
            <p>Requests for multiple mission resources are acquired together.</p>
            <div className="form-pair">
              <label>
                Resource robot
                <select value={robot.id} onChange={(e) => setSelectedRobot(e.target.value)}>
                  {robots.map((r) => (
                    <option key={r.id}>{r.id}</option>
                  ))}
                </select>
              </label>
              <label>
                Reservation duration
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </label>
              <label>
                Reservation priority
                <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
                  {[5, 4, 3, 2, 1].map((p) => (
                    <option key={p} value={p}>
                      P{p}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button disabled={pending || !!denied} onClick={() => run(command)}>
              Request {resource.id}
            </button>
            {denied && <p>{denied}</p>}
            {message && <p role="status">{message}</p>}
          </section>
        </section>
        <ResourceQueue resource={resource} state={state} />
      </div>
    </div>
  );
}
