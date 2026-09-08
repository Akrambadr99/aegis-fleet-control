import { DomainError } from '../domain/errors';
export interface Scheduler {
  schedule(delay: number, callback: () => void): () => void;
}
export class RealScheduler implements Scheduler {
  schedule(delay: number, callback: () => void) {
    const id = setTimeout(callback, delay);
    return () => clearTimeout(id);
  }
}
export class ManualScheduler implements Scheduler {
  private now = 0;
  private sequence = 0;
  private jobs = new Map<number, { at: number; callback: () => void }>();
  schedule(delay: number, callback: () => void) {
    if (!Number.isFinite(delay) || delay < 0)
      throw new DomainError('invalid', 'Delay must be finite and nonnegative');
    const id = ++this.sequence;
    this.jobs.set(id, { at: this.now + delay, callback });
    return () => {
      this.jobs.delete(id);
    };
  }
  advance(milliseconds: number) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0)
      throw new DomainError('invalid', 'Clock advance must be finite and nonnegative');
    const target = this.now + milliseconds;
    while (true) {
      const next = [...this.jobs]
        .filter(([, job]) => job.at <= target)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      this.now = next[1].at;
      this.jobs.delete(next[0]);
      next[1].callback();
    }
    this.now = target;
  }
  inspectPending() {
    return [...this.jobs]
      .map(([id, job]) => ({ id, at: job.at }))
      .sort((a, b) => a.at - b.at || a.id - b.id);
  }
  get time() {
    return this.now;
  }
  runNext() {
    const next = this.inspectPending()[0];
    if (next) this.advance(next.at - this.now);
  }
  get pending() {
    return this.jobs.size;
  }
}
