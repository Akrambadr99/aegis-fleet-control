import { expect, it } from 'vitest';
import { DomainError, recoveryFor } from './errors';
import { GatewayError } from '../gateway/requests';
it('preserves gateway compatibility while providing explicit conflict recovery', () => {
  expect(new GatewayError('stale', 'Changed')).toBeInstanceOf(DomainError);
  expect(recoveryFor(new DomainError('stale', 'Changed'))).toBe('refresh');
  expect(recoveryFor(new DomainError('conflict', 'Owned', 'ownership'))).toBe('reacquire');
  expect(recoveryFor(new DomainError('forbidden', 'Denied'))).toBe('request-access');
  expect(recoveryFor(new DomainError('cancelled', 'Cancelled'))).toBe('none');
});
