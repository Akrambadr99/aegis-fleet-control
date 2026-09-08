import { appendHistory } from '../domain/history';
import { synchronizeControls } from '../domain/teleoperation';
import { synchronizeResources } from '../domain/resources';
import { rankCandidates, synchronizeJobs } from '../domain/jobs';
import { validatePlan, type MissionPlan } from '../domain/planning';
import type { Actor, Command, DomainState, RoutePreview } from '../domain/model';
import { createSeed } from '../domain/seed';
import { applyCommand, record } from '../domain/transactions';
import { readiness } from '../domain/selectors';
import { robotPath, positionOnRoute } from '../domain/navigation';
import { GatewayError, RequestEngine, type Ticket } from './requests';
import { RealScheduler, type Scheduler } from './scheduler';
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}
export class FleetGateway {
  private state: DomainState;
  private listeners = new Set<() => void>();
  readonly requests: RequestEngine;
  constructor(scheduler: Scheduler = new RealScheduler(), state: DomainState = createSeed()) {
    this.state = freeze(structuredClone(state));
    this.requests = new RequestEngine(scheduler);
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: DomainState) {
    next.revision = this.state.revision + 1;
    this.state = freeze(next);
    this.listeners.forEach((listener) => listener());
  }
  command(actor: Actor, command: Command, signal?: AbortSignal): Ticket<{ revision: number }> {
    const input = structuredClone(command),
      identity = structuredClone(actor);
    return this.requests.run(() => {
      const next = structuredClone(this.state);
      applyCommand(next, identity, input);
      this.publish(next);
      return { revision: next.revision };
    }, signal);
  }
  bulk(actor: Actor, commands: Command[]) {
    const tickets = commands.map((command) => ({
      id: command.id,
      ticket: this.command(actor, command),
    }));
    return Promise.all(
      tickets.map(async ({ id, ticket }) => {
        try {
          await ticket.promise;
          return { id, status: 'confirmed' as const, message: 'Applied' };
        } catch (error) {
          return {
            id,
            status: 'failed' as const,
            message: error instanceof Error ? error.message : 'Failed',
          };
        }
      }),
    );
  }
  rankJobCandidates(id: string, signal?: AbortSignal) {
    const snapshot = this.state;
    return this.requests.run(() => {
      if (this.state.revision !== snapshot.revision)
        throw new GatewayError('stale', 'Fleet state changed; refresh candidates');
      if (!snapshot.jobs[id]) throw new GatewayError('missing', 'Job not found');
      return rankCandidates(snapshot, snapshot.jobs[id]);
    }, signal);
  }
  validateMissionPlan(plan: MissionPlan, signal?: AbortSignal) {
    const snapshot = this.state,
      input = structuredClone(plan);
    return this.requests.run(() => {
      if (this.state.revision !== snapshot.revision)
        throw new GatewayError('stale', 'Operational state changed; validate again');
      return validatePlan(snapshot, input);
    }, signal);
  }
  readRobot(id: string, signal?: AbortSignal) {
    const snapshot = this.state.robots[id];
    return this.requests.run(() => {
      if (!snapshot) throw new GatewayError('missing', 'Robot not found');
      return structuredClone(snapshot);
    }, signal);
  }
  previewRoute(robotId: string, signal?: AbortSignal): Ticket<RoutePreview> {
    const robot = this.state.robots[robotId];
    if (!robot)
      return this.requests.run(() => {
        throw new GatewayError('missing', 'Robot not found');
      }, signal);
    const snapshot = this.state,
      facility = snapshot.facilities[robot.facilityId],
      topologyRevision = facility.topologyRevision;
    return this.requests.run(() => {
      if (
        this.state.facilities[robot.facilityId].topologyRevision !== topologyRevision ||
        this.state.robots[robotId].revision !== robot.revision
      )
        throw new GatewayError('stale', 'Route inputs changed; calculate again');
      const path = robotPath(snapshot, robotId),
        corridorIds = path?.corridorIds ?? [],
        distance = path?.distance ?? 0;
      const reasons = readiness(snapshot, robot);
      if (!corridorIds.length) reasons.push('No open corridor');
      if (robot.battery < distance * 0.12 + 10) reasons.push('Insufficient battery reserve');
      return {
        robotId,
        robotRevision: robot.revision,
        topologyRevision,
        corridorIds,
        distance,
        batteryRequired: distance * 0.12,
        feasible: reasons.length === 0,
        reasons,
      };
    }, signal);
  }
  advance(ticks = 1) {
    if (!Number.isInteger(ticks) || ticks < 1 || ticks > 100)
      throw new GatewayError('invalid', 'Advance requires 1–100 integer ticks');
    const next = structuredClone(this.state);
    for (let t = 0; t < ticks; t++) {
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
            ' delivered',
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
      appendHistory(next, Object.values(next.robots));
    }
    // Retain a bounded live window; activity and replay remain session history.
    next.telemetry = next.telemetry.slice(-2400);
    this.publish(next);
  }
}
