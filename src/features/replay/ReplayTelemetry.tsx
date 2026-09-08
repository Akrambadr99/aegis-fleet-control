import type { RobotHistory } from '../../domain/history';
export function ReplayTelemetry({ frames, index }: { frames: RobotHistory[]; index: number }) {
  const firstTick = frames[0]?.tick ?? 0,
    lastTick = frames.at(-1)?.tick ?? firstTick;
  const sample = frames[index];
  if (lastTick <= firstTick)
    return (
      <section className="replay-telemetry">
        <h2>Synchronized telemetry</h2>
        <p>Record at least two simulation ticks to compare battery and velocity over time.</p>
        {sample && (
          <p>
            Tick {sample.tick} · Battery {sample.battery.toFixed(1)}% · Velocity{' '}
            {sample.velocity.toFixed(2)} m/s
          </p>
        )}
      </section>
    );
  const x = (tick: number) => 65 + ((tick - firstTick) / (lastTick - firstTick)) * 620;
  const maxVelocity = Math.max(1, ...frames.map((frame) => frame.velocity));
  return (
    <section className="replay-telemetry">
      <h2>Synchronized telemetry</h2>
      <svg viewBox="0 0 700 165" role="img" aria-label="Recorded battery and velocity">
        <text x="4" y="14" fontSize="10">
          Battery %
        </text>
        <text x="4" y="28" fontSize="9">
          100
        </text>
        <text x="35" y="68" fontSize="9">
          0
        </text>
        <path d="M65 20H685M65 65H685M65 90H685M65 135H685" stroke="#c0cdd3" fill="none" />
        <polyline
          points={frames.map((frame) => `${x(frame.tick)},${65 - frame.battery * 0.45}`).join(' ')}
          stroke="#21785e"
          fill="none"
          strokeWidth="2"
        />
        <text x="4" y="88" fontSize="10">
          m/s
        </text>
        <text x="4" y="102" fontSize="9">
          {maxVelocity.toFixed(2)}
        </text>
        <text x="35" y="137" fontSize="9">
          0
        </text>
        <polyline
          points={frames
            .map((frame) => `${x(frame.tick)},${135 - (frame.velocity / maxVelocity) * 45}`)
            .join(' ')}
          stroke="#326c99"
          fill="none"
          strokeWidth="2"
        />
        {sample && (
          <line
            x1={x(sample.tick)}
            x2={x(sample.tick)}
            y1="17"
            y2="140"
            stroke="#b14834"
            strokeWidth="2"
          />
        )}
        <text x="65" y="157" fontSize="10">
          Tick {firstTick}
        </text>
        <text x="685" y="157" textAnchor="end" fontSize="10">
          Tick {lastTick}
        </text>
      </svg>
      {sample && (
        <p className="telemetry-reading">
          Selected tick {sample.tick} · Battery {sample.battery.toFixed(1)}% · Velocity{' '}
          {sample.velocity.toFixed(2)} m/s
        </p>
      )}
    </section>
  );
}
