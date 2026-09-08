import { useState } from 'react';
import { useScope } from '../../hooks/useWorkspaceScope';
import { useFleet } from '../../app/FleetProvider';
import type { Role } from '../../domain/model';
import { trafficConflicts } from '../../domain/selectors';
import { TrafficMap, type TrafficLayers } from './TrafficMap';
import { CorridorControls } from './CorridorControls';
import { RobotInspector } from '../operations';
import { ResourceQueue } from '../resources';
export function TrafficWorkspace() {
  const { state, floor, facility, params, change } = useScope(),
    { gateway, actor, setRole, controlScope, setControlScope } = useFleet();
  const [layers, setLayers] = useState<TrafficLayers>({
    routes: true,
    robots: true,
    resources: true,
  });
  const resource = state.resources[params.get('resource') ?? ''];
  const conflicts = trafficConflicts(state, facility.id);
  const routes = Object.values(state.routes).filter(
    (r) =>
      state.robots[r.robotId].floorId === floor.id &&
      state.missions[state.robots[r.robotId].activeMissionId ?? '']?.routeId === r.id,
  );
  return (
    <div className="traffic-workspace">
      <header className="traffic-header">
        <div>
          <p className="eyebrow">SPATIAL OPERATIONS</p>
          <h1>Traffic control</h1>
        </div>
        <span>
          Topology revision {facility.topologyRevision} · {conflicts.length} impacted route
          reservations · Tick {state.tick}
        </span>
        <button onClick={() => gateway.advance()}>Advance simulation</button>
      </header>
      <div className="traffic-toolbar">
        <label>
          Operating facility
          <select value={facility.id} onChange={(e) => change('facility', e.target.value)}>
            {Object.values(state.facilities).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Floor
          <select value={floor.id} onChange={(e) => change('floor', e.target.value)}>
            {facility.floorIds.map((id) => (
              <option key={id} value={id}>
                {state.floors[id].name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Simulation role
          <select value={actor.role} onChange={(e) => setRole(e.target.value as Role)}>
            {['viewer', 'operator', 'fleet-manager', 'facility-manager', 'administrator'].map(
              (role) => (
                <option key={role}>{role}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Control scope
          <select value={controlScope} onChange={(e) => setControlScope(e.target.value)}>
            <option value="all">All facilities</option>
            {Object.values(state.facilities).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="traffic-layers" aria-label="Map layers">
        {(Object.keys(layers) as (keyof TrafficLayers)[]).map((layer) => (
          <label key={layer}>
            <input
              type="checkbox"
              checked={layers[layer]}
              onChange={(e) => setLayers({ ...layers, [layer]: e.target.checked })}
            />
            {layer}
          </label>
        ))}
        <span>Blue: active · Amber: held · Red: blocked · Squares: shared resources</span>
      </div>
      <div className="traffic-layout">
        <div className="traffic-main">
          <TrafficMap
            state={state}
            floorId={floor.id}
            selectedRobot={params.get('robot')}
            layers={layers}
            selectRobot={(id) => change('robot', id)}
            selectResource={(id) => change('resource', id)}
          />
          <CorridorControls state={state} floorId={floor.id} />
          <section className="route-register">
            <h2>Route reservations</h2>
            <ul className="record-list">
              {routes.map((route) => (
                <li key={route.id}>
                  <button className="text-button" onClick={() => change('robot', route.robotId)}>
                    {route.robotId}
                  </button>{' '}
                  · {route.corridorIds.join(', ') || 'Station access'} · {route.state} ·{' '}
                  {route.reservationState} · P
                  {state.missions[state.robots[route.robotId].activeMissionId!].priority}
                  {route.resourceIds?.length ? ' · ' + route.resourceIds.join(', ') : ''}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="traffic-context">
          {resource && resource.floorId === floor.id ? (
            <ResourceQueue resource={resource} state={state} />
          ) : params.get('robot') ? (
            <RobotInspector />
          ) : (
            <section>
              <h2>Traffic inspector</h2>
              <p>Select a robot or resource directly on the map.</p>
              <h3>Current conflicts</h3>
              {conflicts.map((route) => (
                <p key={route.id}>
                  {route.robotId} · {route.state} · {route.reservationState}
                </p>
              ))}
              {!conflicts.length && <p>No blocked reservations in this facility.</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
