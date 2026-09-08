import type { FacilitySnapshot } from './snapshot';
export function FacilityPreview({ facility }: { facility: FacilitySnapshot }) {
  return (
    <svg
      className="facility-preview"
      viewBox="0 0 700 320"
      role="img"
      aria-label={`${facility.name} ground floor layout with shared zones, robot routes and chargers`}
    >
      <rect width="700" height="320" fill="#eff4f6" />
      {facility.nodes.map((zone) => (
        <g key={zone.id}>
          <rect
            x={zone.x - 25}
            y={zone.y - 25}
            width="85"
            height="60"
            rx="4"
            fill="#dce9e6"
            stroke="#c0d4ce"
          />
          <text x={zone.x - 15} y={zone.y + 5} fontSize="10" fill="#425f69">
            {zone.name}
          </text>
        </g>
      ))}
      {facility.corridors.map((corridor, index) => (
        <g key={corridor.id}>
          <path
            d={`M35 ${145 + index * 20}H665`}
            fill="none"
            stroke={corridor.open ? '#559c92' : '#b54747'}
            strokeWidth="3"
            strokeDasharray="7 5"
          />
          <text x="40" y={140 + index * 20} fontSize="9">
            {corridor.id} · {corridor.open ? 'open' : 'closed'}
          </text>
        </g>
      ))}
      {facility.robots.map((robot) => (
        <g key={robot.id}>
          <circle
            cx={robot.position.x}
            cy={robot.position.y}
            r="7"
            fill={robot.status === 'emergency-stopped' ? '#b33b35' : '#247d70'}
            stroke="white"
            strokeWidth="2"
          />
          <text x={robot.position.x} y={robot.position.y + 20} textAnchor="middle" fontSize="8">
            {robot.id}
          </text>
        </g>
      ))}
    </svg>
  );
}
