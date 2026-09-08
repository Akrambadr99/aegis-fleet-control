export function ControlPad({
  enabled,
  pending,
  move,
}: {
  enabled: boolean;
  pending: boolean;
  move: (dx: number, dy: number) => Promise<void>;
}) {
  return (
    <section className="motion-console" aria-label="Manual motion controls">
      <h2>Motion commands</h2>
      <div className="direction-pad">
        <button
          className="direction-up"
          disabled={!enabled || pending}
          onClick={() => move(0, -1)}
          aria-label="Move forward"
        >
          ↑
        </button>
        <button
          className="direction-left"
          disabled={!enabled || pending}
          onClick={() => move(-1, 0)}
          aria-label="Move left"
        >
          ←
        </button>
        <span className="motion-center">
          DEADMAN
          <br />
          {enabled ? 'ARMED' : 'LOCKED'}
        </span>
        <button
          className="direction-right"
          disabled={!enabled || pending}
          onClick={() => move(1, 0)}
          aria-label="Move right"
        >
          →
        </button>
        <button
          className="direction-down"
          disabled={!enabled || pending}
          onClick={() => move(0, 1)}
          aria-label="Move backward"
        >
          ↓
        </button>
      </div>
      <p>
        Arrow keys / WASD · Hold to repeat acknowledged motion. Releasing a key stops sending
        commands.
      </p>
    </section>
  );
}
