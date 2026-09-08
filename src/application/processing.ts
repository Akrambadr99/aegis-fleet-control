import type { DomainState } from '../domain/model';
import { DomainError as GatewayError } from '../domain/errors';
import { synchronizeControls } from '../domain/teleoperation';
import { synchronizeResources } from '../domain/resources';
import { synchronizeJobs } from '../domain/jobs';
import { positionOnRoute } from '../domain/navigation';
import { appendHistory } from '../domain/history';
import { record } from '../domain/transactions';
import { processAutomation } from './automationEngine';
import { defaultConfiguration, type OperationalConfiguration } from './configuration';
export function advanceDomain(
  state: DomainState,
  ticks = 1,
  configuration: Readonly<OperationalConfiguration> = defaultConfiguration,
) {
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > 100)
    throw new GatewayError('invalid', 'Advance requires 1–100 integer ticks');
  const next = structuredClone(state);
  for (let t = 0; t < ticks; t++) {
    const eventStart = next.activity.length;
    next.tick++;
    for (const change of synchronizeControls(next))
      record(
        next,
        { id: 'clock', role: 'administrator' },
        'control.lost',
        change.robot.id,
        change.reason,
        [change.robot],
      );
    for (const change of synchronizeResources(next))
      record(
        next,
        { id: 'clock', role: 'administrator' },
        change.event,
        change.resourceId,
        'Resource ownership transition',
        [change.robot],
      );
    for (const robot of Object.values(next.robots)) {
      const mission = robot.activeMissionId ? next.missions[robot.activeMissionId] : null;
      let velocity = 0;
      if (robot.connected && robot.status === 'running' && mission?.status === 'running') {
        robot.position = positionOnRoute(
          next,
          next.routes[mission.routeId],
          Math.min(100, mission.progress + 1),
        );
        robot.battery = Math.max(0, Number((robot.battery - 0.1).toFixed(1)));
        robot.revision++;
        velocity = 1.2;
        mission.progress = Math.min(100, mission.progress + 1);
        mission.revision++;
        if (mission.progress === 100) {
          mission.status = 'completed';
          robot.status = 'idle';
          robot.lastMissionId = mission.id;
          robot.activeMissionId = null;
          const route = next.routes[mission.routeId];
          route.reservationState = 'released';
          route.revision++;
          record(
            next,
            { id: 'clock', role: 'administrator' },
            'mission.completed',
            mission.id,
            'Mission completed',
            [robot],
          );
        } else if (robot.battery < 20) {
          robot.status = 'paused';
          mission.status = 'paused';
          mission.pauseReason = 'Battery reserve reached';
          const route = next.routes[mission.routeId];
          route.reservationState = 'held';
          route.revision++;
          record(
            next,
            { id: 'clock', role: 'administrator' },
            'robot.low-battery',
            robot.id,
            'Mission paused at battery reserve',
            [robot],
          );
        }
      }
      next.telemetry.push({
        robotId: robot.id,
        tick: next.tick,
        battery: robot.battery,
        x: robot.position.x,
        y: robot.position.y,
        velocity,
      });
    }
    for (const change of synchronizeJobs(next))
      record(
        next,
        { id: 'clock', role: 'administrator' },
        change.event,
        change.job.id,
        change.job.title +
          ' · ' +
          change.job.completedUnits +
          '/' +
          change.job.units +
          ' completed',
        [change.robot],
      );
    for (const change of synchronizeResources(next))
      record(
        next,
        { id: 'clock', role: 'administrator' },
        change.event,
        change.resourceId,
        'Resource ownership transition',
        [change.robot],
      );
    if (configuration.automatedRecovery) processAutomation(next, eventStart, configuration);
    appendHistory(next, Object.values(next.robots));
  }
  // Retain a bounded live window; activity and replay remain session history.
  next.telemetry = next.telemetry.slice(-2400);
  return next;
}
