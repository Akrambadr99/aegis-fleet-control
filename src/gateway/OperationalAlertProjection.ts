import {
  filterOperationalAlerts,
  projectOperationalAlerts,
  type OperationalAlert,
} from '../application/projections';
import type { Actor, DomainState } from '../domain/model';
import type { CommittedEventBatch } from './CommittedEventStream';

/** Bounded read model maintained from the exact post-commit event batches. */
export class OperationalAlertProjection {
  private alerts: readonly Readonly<OperationalAlert>[];
  private readonly listeners = new Set<() => void>();

  constructor(state: DomainState) {
    this.alerts = this.freeze(projectOperationalAlerts(state, state.activity).slice(-200));
  }

  getSnapshot = () => this.alerts;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  ingest(batch: CommittedEventBatch, state: DomainState) {
    const projected = projectOperationalAlerts(state, batch.events);
    if (!projected.length) return;
    this.alerts = this.freeze([...this.alerts, ...projected].slice(-200));
    this.listeners.forEach((listener) => listener());
  }

  forActor(actor: Actor) {
    return filterOperationalAlerts(this.alerts, actor);
  }

  private freeze(alerts: OperationalAlert[]) {
    return Object.freeze(alerts.map((alert) => Object.freeze(alert)));
  }
}
