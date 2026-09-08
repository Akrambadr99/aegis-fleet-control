import type { CommittedEventBatch } from './CommittedEventStream';
import type { Scheduler } from './scheduler';

export interface BackgroundWorkerDefinition {
  id: string;
  handle(batch: CommittedEventBatch): void | Promise<void>;
  retryDelays?: readonly number[];
}

export interface BackgroundWorkerStatus {
  id: string;
  state: 'idle' | 'scheduled' | 'running' | 'retrying' | 'failed';
  pendingBatches: number;
  attempts: number;
  lastProcessedRevision: number | null;
  lastError?: string;
}

interface WorkerRuntime extends BackgroundWorkerStatus {
  definition: BackgroundWorkerDefinition;
  queue: CommittedEventBatch[];
  cancelScheduled: (() => void) | null;
  active: boolean;
}

const defaultRetryDelays = [100, 500, 2_000] as const;

/** Runs each worker's committed batches in order without affecting command success. */
export class BackgroundWorkerHost {
  private readonly workers = new Map<string, WorkerRuntime>();
  private readonly listeners = new Set<() => void>();
  private snapshot: readonly Readonly<BackgroundWorkerStatus>[] = Object.freeze([]);

  constructor(private readonly scheduler: Scheduler) {}

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  register(definition: BackgroundWorkerDefinition) {
    if (!definition.id.trim() || this.workers.has(definition.id))
      throw new Error('Background worker IDs must be unique and nonempty');
    const retryDelays = definition.retryDelays ?? defaultRetryDelays;
    if (retryDelays.some((delay) => !Number.isFinite(delay) || delay < 0))
      throw new Error('Background worker retry delays must be finite and nonnegative');
    const runtime: WorkerRuntime = {
      definition: Object.freeze({
        ...definition,
        retryDelays: Object.freeze([...retryDelays]),
      }),
      queue: [],
      cancelScheduled: null,
      active: true,
      id: definition.id,
      state: 'idle',
      pendingBatches: 0,
      attempts: 0,
      lastProcessedRevision: null,
    };
    this.workers.set(definition.id, runtime);
    this.publish();
    return () => {
      runtime.active = false;
      runtime.cancelScheduled?.();
      runtime.queue = [];
      runtime.pendingBatches = 0;
      this.workers.delete(definition.id);
      this.publish();
    };
  }

  enqueue = (batch: CommittedEventBatch) => {
    for (const worker of this.workers.values()) {
      if (
        (worker.lastProcessedRevision !== null && batch.revision <= worker.lastProcessedRevision) ||
        worker.queue.some((queued) => queued.revision === batch.revision)
      )
        continue;
      worker.queue.push(batch);
      worker.pendingBatches = worker.queue.length;
      if (worker.state === 'idle') this.schedule(worker, 0, 'scheduled');
      else this.publish();
    }
  };

  retry(id: string) {
    const worker = this.workers.get(id);
    if (!worker || worker.state !== 'failed' || !worker.queue.length) return false;
    worker.attempts = 0;
    worker.lastError = undefined;
    this.schedule(worker, 0, 'scheduled');
    return true;
  }

  private schedule(
    worker: WorkerRuntime,
    delay: number,
    state: Extract<BackgroundWorkerStatus['state'], 'scheduled' | 'retrying'>,
  ) {
    worker.state = state;
    worker.cancelScheduled = this.scheduler.schedule(delay, () => {
      worker.cancelScheduled = null;
      void this.run(worker);
    });
    this.publish();
  }

  private async run(worker: WorkerRuntime) {
    if (!worker.active) return;
    const batch = worker.queue[0];
    if (!batch) {
      worker.state = 'idle';
      this.publish();
      return;
    }
    worker.state = 'running';
    worker.attempts++;
    this.publish();
    try {
      await worker.definition.handle(batch);
      if (!worker.active) return;
      worker.queue.shift();
      worker.pendingBatches = worker.queue.length;
      worker.lastProcessedRevision = batch.revision;
      worker.attempts = 0;
      worker.lastError = undefined;
      if (worker.queue.length) this.schedule(worker, 0, 'scheduled');
      else {
        worker.state = 'idle';
        this.publish();
      }
    } catch (error) {
      if (!worker.active) return;
      worker.lastError = error instanceof Error ? error.message : 'Background worker failed';
      const retryDelays = worker.definition.retryDelays ?? defaultRetryDelays;
      const delay = retryDelays[worker.attempts - 1];
      if (delay === undefined) {
        worker.state = 'failed';
        this.publish();
      } else this.schedule(worker, delay, 'retrying');
    }
  }

  private publish() {
    this.snapshot = Object.freeze(
      [...this.workers.values()]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(({ id, state, pendingBatches, attempts, lastProcessedRevision, lastError }) =>
          Object.freeze({
            id,
            state,
            pendingBatches,
            attempts,
            lastProcessedRevision,
            ...(lastError ? { lastError } : {}),
          }),
        ),
    );
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
        // A broken observer cannot stop worker execution or other observers.
      }
    }
  }
}
