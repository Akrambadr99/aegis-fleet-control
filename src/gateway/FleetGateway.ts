import { advanceDomain } from '../application/processing';
import { defaultConfiguration, type OperationalConfiguration } from '../application/configuration';
import { exportSnapshot, migrateSnapshot, type SnapshotEnvelope } from '../domain/snapshots';
import { executeTransaction } from '../application/transactions';
import { validateRule, evaluateRule, type RuleInput } from '../domain/automation';
import { rankCandidates } from '../domain/jobs';
import { validatePlan, type MissionPlan } from '../domain/planning';
import type { Actor, Command, DomainState, RoutePreview } from '../domain/model';
import { createSeed } from '../domain/seed';
import { readiness } from '../domain/selectors';
import { commandPermission } from '../domain/permissions';
import { assertInvariants } from '../domain/invariants';
import { robotPath } from '../domain/navigation';
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
  private operationSequence = 0;
  readonly configuration: Readonly<OperationalConfiguration>;
  private listeners = new Set<() => void>();
  readonly requests: RequestEngine;
  constructor(
    scheduler: Scheduler = new RealScheduler(),
    state: DomainState = createSeed(),
    configuration: OperationalConfiguration = defaultConfiguration,
  ) {
    this.configuration = Object.freeze({ ...configuration });
    this.state = freeze(structuredClone(state));
    this.requests = new RequestEngine(scheduler);
  }
  exportSnapshot = () => exportSnapshot(this.state);
  static fromSnapshot(snapshot: DomainState | SnapshotEnvelope, scheduler?: Scheduler) {
    return new FleetGateway(scheduler, migrateSnapshot(snapshot).state);
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: DomainState) {
    assertInvariants(next);
    next.revision = this.state.revision + 1;
    this.state = freeze(next);
    this.listeners.forEach((listener) => listener());
  }
  command(actor: Actor, command: Command, signal?: AbortSignal): Ticket<{ revision: number }> {
    const input = structuredClone(command),
      identity = structuredClone(actor);
    const operationId = 'OP-' + this.state.revision + '-' + ++this.operationSequence;
    return this.requests.run(
      () => {
        const next = executeTransaction(
          this.state,
          identity,
          input,
          {
            operationId,
            correlationId: operationId,
          },
          this.configuration,
        );
        this.publish(next);
        return { revision: next.revision };
      },
      signal,
      { operationId, entityId: input.id, action: input.type, actorId: identity.id },
    );
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
  validateAutomation(input: RuleInput, eventId?: string, signal?: AbortSignal) {
    const snapshot = this.state,
      draft = structuredClone(input);
    return this.requests.run(() => {
      if (this.state.revision !== snapshot.revision)
        throw new GatewayError('stale', 'Operational events changed; validate again');
      const issues = validateRule(snapshot, draft),
        event = eventId ? snapshot.activity.find((e) => e.id === eventId) : undefined;
      return { issues, targets: event ? evaluateRule(snapshot, draft, event) : [] };
    }, signal);
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
  validateMissionPlan(plan: MissionPlan, signal?: AbortSignal, actor?: Actor) {
    const snapshot = this.state,
      input = structuredClone(plan),
      identity = actor ? structuredClone(actor) : undefined;
    return this.requests.run(() => {
      if (this.state.revision !== snapshot.revision)
        throw new GatewayError('stale', 'Operational state changed; validate again');
      const result = validatePlan(snapshot, input);
      if (identity) {
        const denied = commandPermission(snapshot, identity, {
          type: 'plan.save',
          id: input.id,
          expectedRevision: input.revision,
          plan: input,
        });
        if (denied) result.issues.push({ stepId: null, message: denied });
      }
      return result;
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
    this.publish(advanceDomain(this.state, ticks, this.configuration));
  }
}
