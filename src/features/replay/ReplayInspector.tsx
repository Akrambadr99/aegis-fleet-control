import type { RobotHistory } from '../../domain/history';
export function ReplayInspector({ sample }: { sample: RobotHistory }) {
  return (
    <aside className="replay-inspector" aria-label="Recorded robot state">
      <h2>State at tick {sample.tick}</h2>
      <dl>
        <div>
          <dt>Robot</dt>
          <dd>
            {sample.robotId} · {sample.status}
          </dd>
        </div>
        <div>
          <dt>Mission</dt>
          <dd>{sample.missionId ?? 'None'}</dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd>{sample.missionProgress?.toFixed(1) ?? '—'}%</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd data-testid="replay-position">
            {sample.position.x.toFixed(3)}, {sample.position.y.toFixed(3)}
          </dd>
        </div>
        <div>
          <dt>Battery</dt>
          <dd>{sample.battery.toFixed(2)}%</dd>
        </div>
        <div>
          <dt>Velocity</dt>
          <dd>{sample.velocity.toFixed(2)} m/s</dd>
        </div>
        <div>
          <dt>Control owner</dt>
          <dd>{sample.controlOwner ?? 'No manual owner'}</dd>
        </div>
        <div>
          <dt>Topology</dt>
          <dd>Revision {sample.topologyRevision}</dd>
        </div>
      </dl>
      <h3>Recorded faults</h3>
      {sample.faults.length ? (
        <ul>
          {sample.faults.map((f) => (
            <li key={f.id}>
              {f.id} · {f.status}
              <p>{f.message}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No faults recorded at this frame.</p>
      )}
      <h3>Owned resources</h3>
      <p>{sample.resources.join(', ') || 'None at this frame'}</p>
    </aside>
  );
}
