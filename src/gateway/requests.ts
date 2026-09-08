import type { Scheduler } from './scheduler';
export type RequestStatus =
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'cancelled'
  | 'stale'
  | 'superseded';
export class GatewayError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}
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
export class RequestEngine {
  private sequence = 0;
  private plans: RequestPlan[] = [];
  constructor(private scheduler: Scheduler) {}
  plan(...plans: RequestPlan[]) {
    this.plans.push(...plans);
  }
  run<T>(operation: () => T, signal?: AbortSignal): Ticket<T> {
    const id = ++this.sequence,
      plan = this.plans.shift() ?? {},
      ticket = {} as Ticket<T>;
    let stop = () => {};
    let rejectPromise: (error: Error) => void = () => {};
    const cleanup = () => {
      stop();
      signal?.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      if (ticket.status !== 'pending') return;
      ticket.status = 'cancelled';
      cleanup();
      rejectPromise(new GatewayError('cancelled', 'Operation cancelled'));
    };
    ticket.id = id;
    ticket.status = 'pending';
    ticket.cancel = cancel;
    ticket.supersede = () => {
      if (ticket.status !== 'pending') return;
      ticket.status = 'superseded';
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
          cleanup();
          resolve(result);
        } catch (error) {
          ticket.status =
            error instanceof GatewayError && error.code === 'stale' ? 'stale' : 'failed';
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
