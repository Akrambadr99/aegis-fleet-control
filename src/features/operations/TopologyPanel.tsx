import { useScope } from './useScope';
import { CommandButton } from '../../components/CommandButton';
import { trafficConflicts } from '../../domain/selectors';
export function TopologyPanel({ map = false }: { map?: boolean }) {
  const { state, floor, facility, change } = useScope();
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
          <svg
            className="live-map"
            viewBox="0 0 700 320"
            role="img"
            aria-label={`${floor.name} shared topology`}
          >
            {floor.zoneIds.map((id) => {
              const zone = state.zones[id];
              return (
                <g key={id}>
                  <rect
                    x={zone.x - 25}
                    y={zone.y - 25}
                    width="85"
                    height="60"
                    rx="4"
                    fill="#dce9e6"
                  />
                  <text x={zone.x - 15} y={zone.y + 5}>
                    {zone.name}
                  </text>
                </g>
              );
            })}
            {floor.corridorIds.map((id, i) => (
              <g key={id}>
                <path
                  d={`M35 ${150 + i * 18}H665`}
                  stroke={state.corridors[id].open ? '#369886' : '#be4e4e'}
                  strokeWidth="4"
                  strokeDasharray="7 4"
                />
                <text x="40" y={145 + i * 18}>
                  {id} {state.corridors[id].open ? 'open' : 'closed'}
                </text>
              </g>
            ))}
            {robots.map((robot) => (
              <circle
                key={robot.id}
                cx={robot.position.x}
                cy={robot.position.y}
                r="7"
                fill={robot.status === 'emergency-stopped' ? '#c34d41' : '#1c526b'}
              />
            ))}
          </svg>
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
          .filter((r) => state.robots[r.robotId].floorId === floor.id)
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
