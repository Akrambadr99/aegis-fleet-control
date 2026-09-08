import { useEffect, useMemo, useState } from 'react';
import { useScope } from '../operations/useScope';
import { robotHistory } from '../../domain/history';
import { ReplayTransport } from './ReplayTransport';
import { ReplayScene } from './ReplayScene';
import { ReplayInspector } from './ReplayInspector';
import { ReplayTelemetry } from './ReplayTelemetry';
export function ReplayWorkspace() {
  const { state, params, change } = useScope(),
    robotId = state.robots[params.get('robot') ?? '']?.id ?? 'R-001';
  const [missionId, setMissionId] = useState(''),
    [cursor, setCursor] = useState<number | null>(null),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1);
  const allFrames = useMemo(() => robotHistory(state, robotId), [state, robotId]);
  const frames = useMemo(
    () => allFrames.filter((f) => !missionId || f.missionId === missionId),
    [allFrames, missionId],
  );
  const index = Math.max(0, Math.min(cursor ?? frames.length - 1, frames.length - 1)),
    sample = frames[index];
  useEffect(() => {
    if (!playing) return;
    if (index >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const delay = Math.max(40, ((frames[index + 1].tick - frames[index].tick) * 1000) / speed);
    const timer = setTimeout(() => setCursor(index + 1), delay);
    return () => clearTimeout(timer);
  }, [playing, index, frames, speed]);
  function seek(next: number) {
    setPlaying(false);
    setCursor(next);
  }
  const events = frames.flatMap((f, i) => {
    const event = f.eventId ? state.activity.find((e) => e.id === f.eventId) : null;
    return event ? [{ event, index: i }] : [];
  });
  return (
    <div className="replay-workspace">
      <header className="editor-header">
        <div>
          <p className="eyebrow">MISSION INVESTIGATION</p>
          <h1>Mission replay</h1>
          <span>
            Recorded window · {frames.length} samples · Live tick {state.tick}
          </span>
        </div>
        <div className="editor-actions">
          <label>
            Replay robot
            <select
              value={robotId}
              onChange={(e) => {
                change('robot', e.target.value);
                setMissionId('');
                setCursor(null);
                setPlaying(false);
              }}
            >
              {Object.keys(state.robots).map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label>
            Recorded mission
            <select
              value={missionId}
              onChange={(e) => {
                setMissionId(e.target.value);
                setCursor(null);
                setPlaying(false);
              }}
            >
              <option value="">All recorded missions</option>
              {[
                ...new Set(allFrames.map((f) => f.missionId).filter((id): id is string => !!id)),
              ].map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
        </div>
      </header>
      {sample ? (
        <>
          <div className="replay-grid">
            <div>
              <ReplayScene state={state} frames={frames} index={index} />
              <ReplayTelemetry frames={frames} index={index} />
            </div>
            <ReplayInspector sample={sample} />
          </div>
          <ReplayTransport
            frames={frames}
            index={index}
            playing={playing}
            speed={speed}
            seek={seek}
            setSpeed={setSpeed}
            toggle={() => {
              if (playing) setPlaying(false);
              else {
                if (index >= frames.length - 1) setCursor(0);
                setPlaying(true);
              }
            }}
          />
          <section className="replay-event-log">
            <h2>Event markers & operator actions</h2>
            <ol>
              {events.map(({ event, index: i }) => (
                <li key={event.id + '-' + i}>
                  <button onClick={() => seek(i)}>
                    Tick {event.tick} · {event.type}
                  </button>
                  <span>
                    {event.actorId} · {event.details}
                  </span>
                </li>
              ))}
            </ol>
            {!events.length && <p>No command events in this recorded selection.</p>}
          </section>
        </>
      ) : (
        <p>No retained recording for this selection.</p>
      )}
    </div>
  );
}
