import { DomainError as GatewayError } from '../domain/errors';
import type { Scheduler } from './scheduler';
export type RequestStatus =
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'cancelled'
  | 'stale'
  | 'superseded';
export { DomainError as GatewayError } from '../domain/errors';
export interface RequestPlan {
  delay?: number;
  failure?: string;
}
export interface Ticket<T> {
  id: number;
  status: RequestStatus;
  promise: Promise<T>;
  cancel: () => void;
  supersede: () => void;
}
export interface OperationRecord {
  operationId: string;
  entityId: string;
  action: string;
  actorId: string;
  status: RequestStatus;
  error?: string;
}
export class RequestEngine {
  private operations: readonly OperationRecord[] = [];
  private listeners = new Set<() => void>();
  getOperations = () => this.operations;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private report(record: OperationRecord) {
    const next = [
      ...this.operations.filter((entry) => entry.operationId !== record.operationId),
      Object.freeze(record),
    ];
    const settled = next.filter((entry) => entry.status !== 'pending').slice(-200);
    this.operations = Object.freeze([
      ...settled,
      ...next.filter((entry) => entry.status === 'pending'),
    ]);
    this.listeners.forEach((listener) => listener());
  }
  private sequence = 0;
  private plans: RequestPlan[] = [];
  constructor(private scheduler: Scheduler) {}
  plan(...plans: RequestPlan[]) {
    this.plans.push(...plans);
  }
  run<T>(
    operation: () => T,
    signal?: AbortSignal,
    context?: Omit<OperationRecord, 'status' | 'error'>,
  ): Ticket<T> {
    const id = ++this.sequence,
      plan = this.plans.shift() ?? {},
      ticket = {} as Ticket<T>;
    const report = (error?: unknown) => {
      if (context)
        this.report({
          ...context,
          status: ticket.status,
          error: error instanceof Error ? error.message : undefined,
        });
    };
    let stop = () => {};
    let rejectPromise: (error: Error) => void = () => {};
    const cleanup = () => {
      stop();
      signal?.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      if (ticket.status !== 'pending') return;
      ticket.status = 'cancelled';
      report();
      cleanup();
      rejectPromise(new GatewayError('cancelled', 'Operation cancelled'));
    };
    ticket.id = id;
    ticket.status = 'pending';
    report();
    ticket.cancel = cancel;
    ticket.supersede = () => {
      if (ticket.status !== 'pending') return;
      ticket.status = 'superseded';
      report();
      cleanup();
      rejectPromise(new GatewayError('superseded', 'A newer request replaced this operation'));
    };
    ticket.promise = new Promise<T>((resolve, reject) => {
      rejectPromise = reject;
      stop = this.scheduler.schedule(plan.delay ?? 250, () => {
        if (ticket.status !== 'pending') return;
        try {
          if (plan.failure) throw new GatewayError('failure', plan.failure);
          const result = operation();
          ticket.status = 'confirmed';
          report();
          cleanup();
          resolve(result);
        } catch (error) {
          ticket.status =
            error instanceof GatewayError && error.code === 'stale' ? 'stale' : 'failed';
          report(error);
          cleanup();
          reject(error);
        }
      });
    });
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancel, { once: true });
    return ticket;
  }
}
