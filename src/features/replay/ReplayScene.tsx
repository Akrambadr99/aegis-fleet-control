import type { DomainState } from '../../domain/model';
import type { RobotHistory } from '../../domain/history';
export function ReplayScene({
  state,
  frames,
  index,
}: {
  state: DomainState;
  frames: RobotHistory[];
  index: number;
}) {
  const sample = frames[index];
  if (!sample) return null;
  const floor = state.floors[sample.floorId];
  return (
    <section className="replay-scene">
      <h2>Recorded movement · {sample.robotId}</h2>
      <svg viewBox="0 0 700 320" role="img" aria-label="Recorded robot movement">
        {floor.zoneIds.map((id) => {
          const z = state.zones[id];
          return (
            <g key={id}>
              <rect x={z.x - 18} y={z.y - 20} width="85" height="50" fill="#dfe8e5" />
              <text x={z.x - 9} y={z.y} fontSize="10">
                {z.id}
              </text>
            </g>
          );
        })}
        <polyline
          points={frames
            .slice(0, index + 1)
            .map((f) => f.position.x + ',' + f.position.y)
            .join(' ')}
          fill="none"
          stroke="#347897"
          strokeWidth="3"
        />
        <circle
          cx={sample.position.x}
          cy={sample.position.y}
          r="8"
          fill={sample.status === 'emergency-stopped' ? '#ac3232' : '#1e5e76'}
          stroke="white"
          strokeWidth="2"
        />
        <text x={sample.position.x + 12} y={sample.position.y - 8} fontSize="11">
          {sample.robotId}
        </text>
      </svg>
      <p>
        Mission {sample.missionStatus ?? 'none'} · Reservation {sample.routeReservation ?? 'none'}
      </p>
    </section>
  );
}
