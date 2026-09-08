import { routePreviewKey } from '../../application/queries';
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useFleet } from '../../app/FleetProvider';
import { useScope } from './useScope';
import { readiness, missionFeasibility } from '../../domain/selectors';
import { CommandButton } from '../../components/CommandButton';
export function RobotInspector() {
  const { state, params, setParams } = useScope();
  const { gateway } = useFleet();
  const id = params.get('robot');
  const robot = id ? state.robots[id] : null;
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = !!id;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);
  const preview = useQuery({
    queryKey: routePreviewKey(state, id),
    queryFn: ({ signal }) => gateway.previewRoute(id!, signal).promise,
    enabled: !!robot,
  });
  if (!id) return null;
  function close() {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('robot');
      return next;
    });
  }
  const mission = robot?.activeMissionId ? state.missions[robot.activeMissionId] : null;
  return (
    <aside
      className="robot-inspector panel"
      aria-label="Robot inspector"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button ref={closeRef} onClick={close}>
        Close inspector
      </button>
      {!robot ? (
        <p role="alert">Robot not found</p>
      ) : (
        <>
          <p className="eyebrow">SHARED ROBOT STATE · REV {robot.revision}</p>
          <h2>{robot.id}</h2>
          <p>
            Capacity {robot.capabilities.payloadKg} kg · {robot.capabilities.actions.join(', ')}
          </p>
          <p>
            {robot.status} · Battery {robot.battery.toFixed(1)}%
          </p>
          <p>
            {robot.connected ? 'Connected' : 'Connection lost'} · {robot.floorId}
          </p>
          <ul>
            {readiness(state, robot).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <CommandButton
            command={{ type: 'robot.stop', id: robot.id, expectedRevision: robot.revision }}
          >
            Emergency stop {robot.id}
          </CommandButton>
          {mission && (
            <>
              <h3>Mission {mission.id}</h3>
              <p>
                {mission.status} · {mission.pauseReason ?? 'No execution block'}
              </p>
              <p>{missionFeasibility(state, mission.id).reasons.join('; ') || 'Feasible'}</p>
            </>
          )}
          {mission && robot.status !== 'emergency-stopped' && (
            <CommandButton
              command={{ type: 'robot.reroute', id: robot.id, expectedRevision: robot.revision }}
            >
              Recalculate route {robot.id}
            </CommandButton>
          )}
          <h3>Route preview</h3>
          {preview.isPending ? (
            <p role="status">Calculating route…</p>
          ) : preview.isError ? (
            <>
              <p role="alert">{preview.error.message}</p>
              <button onClick={() => preview.refetch()}>Retry route</button>
            </>
          ) : (
            <p>
              {preview.data.distance} m · {preview.data.batteryRequired.toFixed(1)}% battery ·{' '}
              {preview.data.feasible ? 'Feasible' : preview.data.reasons.join('; ')}
            </p>
          )}
          <div className="inspector-links">
            {['fleet', 'facilities', 'traffic', 'charging', 'execution', 'telemetry', 'replay'].map(
              (path) => (
                <Link
                  key={path}
                  to={`/${path}?facility=${robot.facilityId}&floor=${robot.floorId}&robot=${robot.id}`}
                >
                  {path}
                </Link>
              ),
            )}
          </div>
        </>
      )}
    </aside>
  );
}
