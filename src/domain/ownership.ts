import { DomainError } from './errors';
export interface OwnershipLease {
  ownerId: string;
  acquiredAt?: number;
  expiresAt: number;
  state: 'active' | 'released';
}
export function ownsLease(
  lease: OwnershipLease | null | undefined,
  ownerId: string,
  tick: number,
): boolean {
  return !!lease && lease.ownerId === ownerId && lease.state === 'active' && lease.expiresAt > tick;
}
export function renewLease(lease: OwnershipLease, ownerId: string, tick: number, duration: number) {
  if (!ownsLease(lease, ownerId, tick))
    throw new DomainError('conflict', 'Control ownership lost', 'ownership');
  if (!Number.isInteger(duration) || duration < 1 || duration > 300)
    throw new DomainError('invalid', 'Lease duration must be 1–300 seconds');
  return { ...lease, expiresAt: tick + duration };
}
