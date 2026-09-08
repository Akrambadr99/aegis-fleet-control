import { useState } from 'react';
import { useScope } from '../operations/useScope';
import { useFleet } from '../../app/FleetProvider';
import { CommandButton } from '../../components/CommandButton';
import { NavigationMap } from '../facilities/NavigationMap';
import { commandPermission } from '../../domain/permissions';
import { ControlPad } from './ControlPad';
import { useMotionKeyboard } from './useMotionKeyboard';
import { useCommand } from '../../hooks/useCommand';
export function TeleoperationWorkspace() {
  const { state, params, facility, floor, change } = useScope(),
    { gateway, actor } = useFleet(),
    { run, pending, message } = useCommand();
  const robot =
    state.robots[params.get('robot') ?? ''] ??
    Object.values(state.robots).find((r) => r.floorId === floor.id)!;
  const [duration, setDuration] = useState(45);
  const lease = robot.controlSessionId ? state.leases[robot.controlSessionId] : null;
  const movement = {
    type: 'control.move' as const,
    id: robot.id,
    expectedRevision: robot.revision,
    dx: 1,
    dy: 0,
  };
  const owns =
    !!lease &&
    lease.ownerId === actor.id &&
    lease.state === 'active' &&
    lease.expiresAt > state.tick &&
    robot.connected &&
    robot.status === 'manual' &&
    !commandPermission(state, actor, movement);
  async function move(dx: number, dy: number) {
    const latest = gateway.getSnapshot().robots[robot.id];
    await run({ type: 'control.move', id: robot.id, expectedRevision: latest.revision, dx, dy });
  }
  useMotionKeyboard(owns, move);
  return (
    <div className="teleoperation-workspace">
      <header className="console-header">
        <div>
          <p className="eyebrow">REMOTE OPERATION / SIMULATED ROBOT</p>
          <h1>Teleoperation console</h1>
        </div>
        <label>
          Controlled robot
          <select value={robot.id} onChange={(e) => change('robot', e.target.value)}>
            {Object.values(state.robots).map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} · {r.facilityId}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => gateway.advance(10)}>Advance 10 seconds</button>
      </header>
      <div className={owns ? 'ownership-strip owned' : 'ownership-strip'} role="status">
        <strong>
          {owns
            ? 'CONTROL OWNED'
            : lease
              ? 'CONTROL HELD BY ' + lease.ownerId
              : 'NO CONTROL OWNERSHIP'}
        </strong>
        <span>
          {robot.connected ? 'Link connected' : 'LINK LOST'} ·{' '}
          {lease
            ? Math.max(0, lease.expiresAt - state.tick) + 's remaining'
            : 'Motion interlock active'}{' '}
          · {actor.id}
        </span>
      </div>
      <div className="teleoperation-grid">
        <section className="console-spatial">
          <h2>
            {facility.name} · {floor.name}
          </h2>
          <NavigationMap
            floorId={robot.floorId}
            robotId={robot.id}
            label="Teleoperation robot position"
          />
          <dl className="telemetry-readout">
            <div>
              <dt>Robot state</dt>
              <dd>{robot.status}</dd>
            </div>
            <div>
              <dt>X position</dt>
              <dd data-testid="control-x">{robot.position.x.toFixed(3)}</dd>
            </div>
            <div>
              <dt>Y position</dt>
              <dd>{robot.position.y.toFixed(3)}</dd>
            </div>
            <div>
              <dt>Battery</dt>
              <dd>{robot.battery.toFixed(2)}%</dd>
            </div>
          </dl>
          <section className="control-receipts">
            <h2>Acknowledged commands</h2>
            <ol>
              {state.activity
                .filter(
                  (e) =>
                    e.entityId === robot.id &&
                    (e.type.startsWith('control.') ||
                      e.type === 'robot.stop' ||
                      e.type === 'robot.connection'),
                )
                .slice(-8)
                .reverse()
                .map((e) => (
                  <li key={e.id}>
                    Tick {e.tick} · {e.type} · {e.details}
                  </li>
                ))}
            </ol>
          </section>
        </section>
        <aside className="operator-console">
          <div className="lease-controls">
            <label>
              Control lease seconds
              <input
                type="number"
                min="1"
                max="300"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </label>
            {lease ? (
              <CommandButton
                command={{
                  type: 'control.release',
                  id: robot.id,
                  expectedRevision: robot.revision,
                }}
              >
                Release control
              </CommandButton>
            ) : (
              <CommandButton
                command={{
                  type: 'control.acquire',
                  id: robot.id,
                  expectedRevision: robot.revision,
                  duration,
                }}
              >
                Acquire control
              </CommandButton>
            )}
          </div>
          <ControlPad enabled={owns} pending={pending} move={move} />
          <section className="emergency-panel">
            <h2>Emergency interlock</h2>
            <CommandButton
              command={{ type: 'robot.stop', id: robot.id, expectedRevision: robot.revision }}
            >
              Emergency stop {robot.id}
            </CommandButton>
            <p>Latches stop, revokes control and releases traffic ownership.</p>
          </section>
          <details className="link-simulation">
            <summary>Simulated link state</summary>
            <CommandButton
              command={{
                type: 'robot.connection',
                id: robot.id,
                expectedRevision: robot.revision,
                connected: !robot.connected,
              }}
            >
              {robot.connected ? 'Simulate connection loss' : 'Restore connection'}
            </CommandButton>
          </details>
          {message && <p role="status">{message}</p>}
        </aside>
      </div>
    </div>
  );
}
