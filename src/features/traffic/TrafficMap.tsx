import { useRef, useState } from 'react';
import type { DomainState } from '../../domain/model';
import { resourceOwners } from '../../domain/resources';
export interface TrafficLayers {
  routes: boolean;
  robots: boolean;
  resources: boolean;
}
export function TrafficMap({
  state,
  floorId,
  selectedRobot,
  layers,
  selectRobot,
  selectResource,
}: {
  state: DomainState;
  floorId: string;
  selectedRobot: string | null;
  layers: TrafficLayers;
  selectRobot: (id: string) => void;
  selectResource: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    drag = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);
  const floor = state.floors[floorId];
  const routes = Object.values(state.routes).filter(
    (r) =>
      state.robots[r.robotId].floorId === floorId &&
      state.missions[state.robots[r.robotId].activeMissionId ?? '']?.routeId === r.id,
  );
  return (
    <section className="traffic-canvas">
      <div className="map-navigation">
        <button
          onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
          aria-label="Zoom traffic map in"
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
          aria-label="Zoom traffic map out"
        >
          −
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          Reset map
        </button>
        <span>{Math.round(zoom * 100)}% · Drag the canvas to pan</span>
      </div>
      <svg
        viewBox={pan.x + ' ' + pan.y + ' ' + 700 / zoom + ' ' + 340 / zoom}
        role="img"
        aria-label="Spatial traffic and resource ownership"
        onPointerDown={(e) => {
          if ((e.target as Element).closest('[data-interactive]')) return;
          drag.current = { x: e.clientX, y: e.clientY, pan };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const ratio = 700 / zoom / e.currentTarget.getBoundingClientRect().width;
          setPan({
            x: drag.current.pan.x - (e.clientX - drag.current.x) * ratio,
            y: drag.current.pan.y - (e.clientY - drag.current.y) * ratio,
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {floor.zoneIds.map((id) => {
          const z = state.zones[id];
          return (
            <g key={id}>
              <rect
                x={z.x - 20}
                y={z.y - 20}
                width="85"
                height="52"
                fill="#edf1ea"
                stroke="#c2ccbd"
              />
              <text x={z.x - 13} y={z.y - 7} fontSize="9">
                {z.id}
              </text>
            </g>
          );
        })}
        {Object.values(state.navigationEdges)
          .filter((e) => state.navigationNodes[e.from].floorId === floorId)
          .map((edge) => {
            const a = state.navigationNodes[edge.from].position,
              b = state.navigationNodes[edge.to].position,
              closed =
                !edge.enabled ||
                (!!edge.corridorId &&
                  (!state.corridors[edge.corridorId].open ||
                    Object.values(state.resources).some(
                      (r) => r.corridorId === edge.corridorId && !r.available,
                    )));
            const offset = edge.corridorId
              ? (floor.corridorIds.indexOf(edge.corridorId) - 1) * 35
              : 0;
            return (
              <g key={edge.id}>
                <path
                  d={
                    'M ' +
                    a.x +
                    ' ' +
                    a.y +
                    ' Q ' +
                    (a.x + b.x) / 2 +
                    ' ' +
                    ((a.y + b.y) / 2 + offset) +
                    ' ' +
                    b.x +
                    ' ' +
                    b.y
                  }
                  stroke={closed ? '#bd4b3f' : '#a4b9bd'}
                  strokeWidth={closed ? 5 : 2}
                  fill="none"
                  strokeDasharray={closed ? '8 4' : undefined}
                />
                {edge.corridorId && (
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 + offset / 2 - 5}
                    fontSize="10"
                    fill={closed ? '#a32c28' : '#4c727b'}
                  >
                    {edge.corridorId}
                    {closed ? ' CLOSED' : ''}
                  </text>
                )}
              </g>
            );
          })}
        {layers.routes &&
          routes.map((route) => {
            const mission = state.missions[state.robots[route.robotId].activeMissionId!];
            return (
              <polyline
                key={route.id}
                data-route={route.id}
                points={route.nodeIds
                  .map((id, i) => {
                    const p =
                      i === 0 && route.origin ? route.origin : state.navigationNodes[id].position;
                    return p.x + ',' + p.y;
                  })
                  .join(' ')}
                fill="none"
                stroke={
                  route.state === 'invalid'
                    ? '#b3352f'
                    : route.reservationState === 'held'
                      ? '#b37d21'
                      : '#276f99'
                }
                strokeWidth={route.robotId === selectedRobot ? 5 : mission.priority >= 4 ? 3 : 1.5}
                opacity={route.reservationState === 'released' ? 0.25 : 0.7}
                strokeDasharray={route.reservationState === 'held' ? '6 3' : undefined}
              >
                <title>
                  {route.robotId} · P{mission.priority} · {route.reservationState}
                </title>
              </polyline>
            );
          })}
        {layers.resources &&
          Object.values(state.resources)
            .filter((r) => r.floorId === floorId)
            .map((resource) => {
              const zone = state.zones[resource.zoneId],
                owners = resourceOwners(state, resource.id),
                waiting = Object.values(state.resourceReservations).filter(
                  (r) => r.resourceId === resource.id && r.state === 'queued',
                ).length;
              return (
                <g
                  data-interactive
                  key={resource.id}
                  role="button"
                  tabIndex={0}
                  aria-label={'Inspect resource ' + resource.id}
                  onClick={() => selectResource(resource.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectResource(resource.id);
                    }
                  }}
                >
                  <rect
                    x={zone.x + 20}
                    y={zone.y + 3}
                    width="16"
                    height="16"
                    fill={
                      !resource.available
                        ? '#b9342e'
                        : waiting
                          ? '#b48220'
                          : owners.length
                            ? '#318668'
                            : '#f7faf4'
                    }
                    stroke="#56716d"
                  />
                  <text x={zone.x + 40} y={zone.y + 15} fontSize="9">
                    {waiting ? 'Q' + waiting : (owners[0]?.robotId ?? 'free')}
                  </text>
                  <title>
                    {resource.name} · {owners.length} owned · {waiting} waiting
                  </title>
                </g>
              );
            })}
        {layers.robots &&
          Object.values(state.robots)
            .filter((r) => r.floorId === floorId)
            .map((robot) => (
              <g
                data-interactive
                key={robot.id}
                role="button"
                tabIndex={0}
                aria-label={'Inspect robot ' + robot.id}
                onClick={() => selectRobot(robot.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectRobot(robot.id);
                  }
                }}
              >
                <circle
                  cx={robot.position.x}
                  cy={robot.position.y}
                  r={robot.id === selectedRobot ? 8 : 5}
                  fill={robot.status === 'emergency-stopped' ? '#b72b28' : '#224c62'}
                  stroke="white"
                />
                <title>
                  {robot.id} · {robot.status}
                </title>
              </g>
            ))}
      </svg>
    </section>
  );
}
