import { useScope } from '../../hooks/useWorkspaceScope';
import { NavigationMap } from '../facilities';
import { CommandButton } from '../../components/CommandButton';
import { trafficConflicts } from '../../domain/selectors';
export function TopologyPanel({ map = false }: { map?: boolean }) {
  const { state, floor, facility, change, params } = useScope();
  const robots = Object.values(state.robots).filter((r) => r.floorId === floor.id);
  return (
    <section className="panel">
      <h2>{map ? 'Facility topology' : 'Corridor control'}</h2>
      <p>
        Topology revision {facility.topologyRevision} ·{' '}
        {trafficConflicts(state, facility.id).length} impacted route reservations
      </p>
      {map && (
        <>
          <NavigationMap
            floorId={floor.id}
            label={floor.name + ' shared topology'}
            robotId={params.get('robot')}
          />
          <p>Select a robot below to inspect shared state alongside the map.</p>
          <div className="control-row">
            {robots.map((r) => (
              <button key={r.id} onClick={() => change('robot', r.id)}>
                {r.id}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="resource-grid">
        {floor.corridorIds.map((id) => {
          const corridor = state.corridors[id];
          return (
            <article key={id} className="resource">
              <h3>
                {id} · {corridor.name}
              </h3>
              <p>
                {corridor.open ? 'Open' : 'Closed'} · {corridor.length} m
              </p>
              <CommandButton
                command={{
                  type: 'corridor.set',
                  id,
                  expectedRevision: corridor.revision,
                  open: !corridor.open,
                }}
              >
                {corridor.open ? 'Close' : 'Open'} {id}
              </CommandButton>
            </article>
          );
        })}
      </div>
      <h3>Route reservations</h3>
      <ul className="record-list">
        {Object.values(state.routes)
          .filter(
            (r) =>
              state.robots[r.robotId].floorId === floor.id &&
              state.missions[state.robots[r.robotId].activeMissionId!]?.routeId === r.id,
          )
          .map((route) => (
            <li key={route.id}>
              <button className="text-button" onClick={() => change('robot', route.robotId)}>
                {route.robotId}
              </button>{' '}
              · {route.corridorIds.join(', ')} · {route.state} · {route.reservationState}
            </li>
          ))}
      </ul>
    </section>
  );
}
