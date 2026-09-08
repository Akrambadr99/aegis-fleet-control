import type { Activity } from '../domain/model';

export interface CommittedEventBatch {
  revision: number;
  events: readonly Readonly<Activity>[];
}

export interface EventDeliveryFailure {
  revision: number;
  eventIds: readonly string[];
  message: string;
}

type EventListener = (batch: CommittedEventBatch) => void;
type StateListener = () => void;

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

/** Ordered post-commit delivery for in-process workers and integrations. */
export class CommittedEventStream {
  private readonly listeners = new Set<EventListener>();
  private readonly stateListeners = new Set<StateListener>();
  private batches: readonly CommittedEventBatch[] = [];
  private failures: readonly EventDeliveryFailure[] = [];
  private queue: CommittedEventBatch[] = [];
  private delivering = false;

  getBatches = () => this.batches;
  getDeliveryFailures = () => this.failures;

  subscribe = (listener: EventListener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  subscribeState = (listener: StateListener) => {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  };

  publish(revision: number, events: readonly Activity[]) {
    if (!events.length) return;
    const batch = freeze({
      revision,
      events: structuredClone(events),
    }) as CommittedEventBatch;
    this.batches = Object.freeze([...this.batches, batch].slice(-256));
    this.queue.push(batch);
    if (!this.delivering) {
      this.drain();
      this.notifyStateListeners(this.batches[this.batches.length - 1]);
    }
  }

  private drain() {
    if (this.delivering) return;
    this.delivering = true;
    try {
      while (this.queue.length) {
        const batch = this.queue.shift()!;
        for (const listener of [...this.listeners]) {
          try {
            listener(batch);
          } catch (error) {
            const failure = freeze({
              revision: batch.revision,
              eventIds: batch.events.map((event) => event.id),
              message: error instanceof Error ? error.message : 'Event subscriber failed',
            });
            this.failures = Object.freeze([...this.failures, failure].slice(-100));
          }
        }
      }
    } finally {
      this.delivering = false;
    }
  }

  private notifyStateListeners(batch: CommittedEventBatch) {
    for (const listener of [...this.stateListeners]) {
      try {
        listener();
      } catch (error) {
        const failure = freeze({
          revision: batch.revision,
          eventIds: batch.events.map((event) => event.id),
          message: error instanceof Error ? error.message : 'Event state subscriber failed',
        });
        this.failures = Object.freeze([...this.failures, failure].slice(-100));
      }
    }
  }
}
