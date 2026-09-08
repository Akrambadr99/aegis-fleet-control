import type { OperationResult } from '../application/operations';
import type { FleetQueries, FleetCommands } from './ports';
import { routePreviewKey } from '../application/queries';
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
import { robotPath } from '../domain/navigation';
import { estimateJourney } from '../domain/motion';
import type { CanonicalStorage } from '../storage/contracts';
import { InMemoryStorageAdapter } from '../storage/InMemoryStorageAdapter';
import { GatewayError, RequestEngine, type Ticket } from './requests';
import { RealScheduler, type Scheduler } from './scheduler';
export class FleetGateway implements FleetQueries, FleetCommands {
  private readonly storage: CanonicalStorage;
  private operationSequence = 0;
  readonly configuration: Readonly<OperationalConfiguration>;
  readonly requests: RequestEngine;
  constructor(
    scheduler: Scheduler = new RealScheduler(),
    source: DomainState | CanonicalStorage = createSeed(),
    configuration: OperationalConfiguration = defaultConfiguration,
  ) {
    this.configuration = Object.freeze({ ...configuration });
    this.storage = 'readSnapshot' in source ? source : new InMemoryStorageAdapter(source);
    this.requests = new RequestEngine(scheduler);
  }
  private get state() {
    return this.storage.readSnapshot();
  }
  exportSnapshot = () => exportSnapshot(this.state);
  static fromSnapshot(snapshot: DomainState | SnapshotEnvelope, scheduler?: Scheduler) {
    return new FleetGateway(scheduler, migrateSnapshot(snapshot).state);
  }
  getSnapshot = () => this.storage.readSnapshot();
  subscribe = (listener: () => void) => this.storage.subscribe(listener);
  private publish(next: DomainState) {
    this.storage.commit(this.state.revision, next);
  }
  command(actor: Actor, command: Command, signal?: AbortSignal): Ticket<OperationResult> {
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
        const events = next.activity.filter((event) => event.operationId === operationId);
        const failures = events
          .filter((event) => event.type === 'automation.failed')
          .map((event) => ({ entityId: event.entityId, message: event.details }));
        return {
          revision: next.revision,
          operationId,
          correlationId: operationId,
          outcome: failures.length ? 'partial' : 'success',
          affectedEntities: [
            ...new Set(
              events.flatMap((event) => [
                event.entityId,
                ...(event.changes ?? []).map((change) => change.entityId),
              ]),
            ),
          ],
          failures,
        } as OperationResult;
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
          const result = await ticket.promise;
          return {
            id,
            status: result.outcome === 'partial' ? ('partial' as const) : ('confirmed' as const),
            message:
              result.outcome === 'partial'
                ? 'Applied with automated follow-up failures'
                : 'Applied',
          };
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
        JSON.stringify(routePreviewKey(this.state, robotId)) !==
        JSON.stringify(routePreviewKey(snapshot, robotId))
      )
        throw new GatewayError('stale', 'Route inputs changed; calculate again');
      const path = robotPath(snapshot, robotId),
        corridorIds = path?.corridorIds ?? [],
        distance = path?.distance ?? 0;
      const reasons = readiness(snapshot, robot);
      const mission = snapshot.missions[robot.activeMissionId ?? ''];
      const estimate = estimateJourney(robot, [
        { distance, payloadKg: mission?.requirements?.payloadKg ?? 0 },
      ]);
      if (!corridorIds.length) reasons.push('No open corridor');
      if (robot.battery < estimate.batteryRequired + estimate.reservePercent)
        reasons.push('Insufficient battery reserve');
      return {
        robotId,
        robotRevision: robot.revision,
        topologyRevision,
        corridorIds,
        distance,
        batteryRequired: estimate.batteryRequired,
        feasible: reasons.length === 0,
        reasons,
      };
    }, signal);
  }
  advance(ticks = 1) {
    this.publish(advanceDomain(this.state, ticks, this.configuration));
  }
}
