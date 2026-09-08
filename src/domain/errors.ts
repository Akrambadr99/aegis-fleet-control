export type ErrorCode =
  | 'stale'
  | 'missing'
  | 'invalid'
  | 'unchanged'
  | 'invariant'
  | 'conflict'
  | 'forbidden'
  | 'offline'
  | 'cancelled'
  | 'superseded'
  | 'failure';
export type ConflictKind =
  | 'revision'
  | 'ownership'
  | 'resource'
  | 'permission'
  | 'scheduling'
  | 'topology'
  | 'reservation';
export class DomainError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public conflict?: ConflictKind,
  ) {
    super(message);
    this.name = 'GatewayError';
    this.conflict =
      conflict ??
      (code === 'stale'
        ? 'revision'
        : code === 'forbidden'
          ? 'permission'
          : code === 'conflict'
            ? 'resource'
            : undefined);
  }
}
export function recoveryFor(
  error: unknown,
): 'refresh' | 'request-access' | 'reacquire' | 'choose-alternative' | 'edit' | 'retry' | 'none' {
  if (!(error instanceof DomainError)) return 'retry';
  if (error.conflict === 'revision' || error.conflict === 'topology') return 'refresh';
  if (error.conflict === 'permission') return 'request-access';
  if (error.conflict === 'ownership') return 'reacquire';
  if (error.conflict) return 'choose-alternative';
  if (error.code === 'invalid') return 'edit';
  if (['cancelled', 'superseded', 'missing', 'unchanged', 'invariant'].includes(error.code))
    return 'none';
  return 'retry';
}
