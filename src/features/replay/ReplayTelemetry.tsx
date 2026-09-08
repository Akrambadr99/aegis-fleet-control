import type { RobotHistory } from '../../domain/history';
export function ReplayTelemetry({ frames, index }: { frames: RobotHistory[]; index: number }) {
  const x = (i: number) => (i / Math.max(1, frames.length - 1)) * 700;
  return (
    <section className="replay-telemetry">
      <h2>Synchronized telemetry</h2>
      <svg viewBox="0 0 700 100" role="img" aria-label="Recorded battery and velocity">
        <path d="M0 80H700" stroke="#9fb6be" />
        <polyline
          points={frames.map((f, i) => x(i) + ',' + (80 - f.battery * 0.65)).join(' ')}
          stroke="#28806a"
          fill="none"
          strokeWidth="2"
        />
        <polyline
          points={frames.map((f, i) => x(i) + ',' + (80 - f.velocity * 25)).join(' ')}
          stroke="#477ea8"
          fill="none"
          strokeWidth="2"
        />
        <line x1={x(index)} x2={x(index)} y1="5" y2="88" stroke="#b14834" strokeWidth="2" />
        <text x="5" y="98" fontSize="10">
          Battery (green) · Velocity (blue) · Selected frame (red)
        </text>
      </svg>
    </section>
  );
}
