import { useId } from 'react';
import type { FacilitySnapshot } from './snapshot';
export function FacilityPreview({ facility }: { facility: FacilitySnapshot }) {
  const patternId = useId();
  return (
    <svg
      className="facility-preview"
      viewBox="0 0 800 390"
      role="img"
      aria-label={`${facility.name} illustrative ground floor layout with four zones, robot routes and chargers`}
    >
      <defs>
        <pattern id={patternId} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#dce4e8" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="800" height="390" fill={`url(#${patternId})`} />
      <rect
        x="35"
        y="35"
        width="730"
        height="320"
        rx="6"
        fill="#f7fafb"
        stroke="#b6c6cd"
        strokeWidth="2"
      />
      {facility.zones.map((zone, index) => (
        <g key={zone}>
          <rect
            x={55 + (index % 2) * 390}
            y={55 + Math.floor(index / 2) * 160}
            width="300"
            height="120"
            rx="4"
            fill={index === 0 ? '#e2eeea' : '#e9eef2'}
            stroke="#c3d0d6"
            strokeDasharray={index === 0 ? '5 4' : undefined}
          />
          <text
            x={70 + (index % 2) * 390}
            y={79 + Math.floor(index / 2) * 160}
            fill="#647884"
            fontSize="12"
            fontFamily="sans-serif"
          >
            {zone.toUpperCase()}
          </text>
          {[0, 1, 2, 3, 4].map((rack) => (
            <rect
              key={rack}
              x={75 + rack * 52 + (index % 2) * 390}
              y={95 + Math.floor(index / 2) * 160}
              width="34"
              height="54"
              rx="2"
              fill="#d0dce2"
              stroke="#bacbd3"
            />
          ))}
        </g>
      ))}
      <path
        d="M130 195H400V115H430M400 195H670M400 195V320"
        fill="none"
        stroke="#559c92"
        strokeWidth="3"
        strokeDasharray="7 5"
      />
      {[
        [180, 195],
        [400, 145],
        [610, 195],
        [400, 295],
        [95, 330],
        [685, 45],
      ].map(([x, y], index) => (
        <g key={index} transform={`translate(${x} ${y})`}>
          <circle r="15" fill="#dcece8" opacity="0.8" />
          <rect
            x="-9"
            y="-7"
            width="18"
            height="14"
            rx="4"
            fill={index === 3 ? '#b97a24' : '#258375'}
            stroke="white"
            strokeWidth="2"
          />
          <text y="28" textAnchor="middle" fill="#506775" fontSize="9">
            R-{String(index + 1).padStart(3, '0')}
          </text>
        </g>
      ))}
      {[0, 1, 2].map((index) => (
        <g key={index}>
          <rect x={275 + index * 28} y="337" width="20" height="14" rx="2" fill="#547aaa" />
          <path d={`M${284 + index * 28} 339l-3 5h5l-3 5`} stroke="white" fill="none" />
        </g>
      ))}
      <text x="720" y="374" fill="#73858f" fontSize="10">
        N ↑
      </text>
    </svg>
  );
}
