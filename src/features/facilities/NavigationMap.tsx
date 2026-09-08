import { useDomain } from '../../app/FleetProvider';
export function NavigationMap({
  floorId,
  label,
  robotId,
}: {
  floorId: string;
  label: string;
  robotId?: string | null;
}) {
  const state = useDomain(),
    floor = state.floors[floorId];
  const robot = robotId ? state.robots[robotId] : null,
    route = robot?.activeMissionId
      ? state.routes[state.missions[robot.activeMissionId].routeId]
      : null;
  return (
    <svg className="live-map" viewBox="0 0 700 320" role="img" aria-label={label}>
      {floor.zoneIds.map((id) => {
        const z = state.zones[id];
        return (
          <g key={id}>
            <rect x={z.x - 20} y={z.y - 20} width="85" height="55" rx="4" fill="#dce9e6" />
            <text x={z.x - 10} y={z.y}>
              {z.name}
            </text>
          </g>
        );
      })}
      {Object.values(state.navigationEdges)
        .filter((edge) => state.navigationNodes[edge.from].floorId === floorId)
        .map((edge) => {
          const a = state.navigationNodes[edge.from].position,
            b = state.navigationNodes[edge.to].position;
          return (
            <line
              key={edge.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={
                edge.corridorId && !state.corridors[edge.corridorId].open ? '#b64b4b' : '#95b8b0'
              }
              strokeWidth="2"
              strokeDasharray={edge.bidirectional ? undefined : '6 3'}
            />
          );
        })}
      {route && robot?.floorId === floorId && (
        <polyline
          points={route.nodeIds
            .map((id, i) => {
              const p = i === 0 && route.origin ? route.origin : state.navigationNodes[id].position;
              return p.x + ',' + p.y;
            })
            .join(' ')}
          fill="none"
          stroke={route.state === 'invalid' ? '#b64b4b' : '#206e9b'}
          strokeWidth="4"
        />
      )}
      {Object.values(state.navigationNodes)
        .filter((n) => n.floorId === floorId)
        .map((n) => (
          <circle key={n.id} cx={n.position.x} cy={n.position.y} r="3" fill="#577c89" />
        ))}
      {Object.values(state.robots)
        .filter((r) => r.floorId === floorId)
        .map((r) => (
          <circle
            key={r.id}
            cx={r.position.x}
            cy={r.position.y}
            r={r.id === robotId ? 8 : 5}
            fill={r.status === 'emergency-stopped' ? '#bf4d39' : '#164e69'}
            stroke="white"
          >
            <title>
              {r.id} · {r.status}
            </title>
          </circle>
        ))}
    </svg>
  );
}
