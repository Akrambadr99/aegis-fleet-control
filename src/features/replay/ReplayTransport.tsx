import type { RobotHistory } from '../../domain/history';
export function ReplayTransport({
  frames,
  index,
  playing,
  speed,
  seek,
  toggle,
  setSpeed,
}: {
  frames: RobotHistory[];
  index: number;
  playing: boolean;
  speed: number;
  seek: (index: number) => void;
  toggle: () => void;
  setSpeed: (speed: number) => void;
}) {
  return (
    <section className="replay-transport" aria-label="Replay transport">
      <div className="transport-buttons">
        <button disabled={!index} onClick={() => seek(0)}>
          Go to start
        </button>
        <button disabled={!index} onClick={() => seek(index - 1)}>
          Previous frame
        </button>
        <button disabled={frames.length < 2} onClick={toggle}>
          {playing ? 'Pause playback' : 'Play recording'}
        </button>
        <button disabled={index >= frames.length - 1} onClick={() => seek(index + 1)}>
          Next frame
        </button>
        <button disabled={index >= frames.length - 1} onClick={() => seek(frames.length - 1)}>
          Go to end
        </button>
        <label>
          Playback speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {[0.25, 0.5, 1, 2, 4].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="replay-seek">
        Replay position
        <input
          type="range"
          min="0"
          max={Math.max(0, frames.length - 1)}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
        />
      </label>
      <div className="time-ruler">
        <span>Tick {frames[0]?.tick ?? 0}</span>
        <strong>
          Recorded tick {frames[index]?.tick ?? 0} · Frame {index + 1}/{frames.length}
        </strong>
        <span>Tick {frames.at(-1)?.tick ?? 0}</span>
      </div>
      <div className="event-markers" aria-label="Timeline event markers">
        {frames.map((f, i) =>
          f.eventId ? (
            <button
              key={f.sequence}
              style={{ left: (i / Math.max(1, frames.length - 1)) * 100 + '%' }}
              aria-label={'Seek event at tick ' + f.tick + ' sequence ' + f.sequence}
              title={'Event at tick ' + f.tick}
              onClick={() => seek(i)}
            >
              │
            </button>
          ) : null,
        )}
      </div>
    </section>
  );
}
