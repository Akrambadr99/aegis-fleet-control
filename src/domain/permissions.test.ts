import { expect, it } from 'vitest';
import { createSeed } from './seed';
import { assertCommandAuthorized, authorizeCommand, canExecute, commandRoles } from './permissions';

it('defines an exhaustive default-deny role policy for every command', () => {
  expect(canExecute('viewer', 'robot.pause')).toBe(false);
  expect(canExecute('operator', 'robot.pause')).toBe(true);
  expect(canExecute('operator', 'control.takeover')).toBe(false);
  expect(canExecute('fleet-manager', 'job.assign')).toBe(true);
  expect(canExecute('facility-manager', 'corridor.set')).toBe(true);
  expect(canExecute('facility-manager', 'job.assign')).toBe(false);
  expect(canExecute('administrator', 'robot.connection')).toBe(true);
  expect(Object.keys(commandRoles)).toHaveLength(35);
});

it('validates actor identity and scope before authorizing a command', () => {
  const state = createSeed();
  const command = { type: 'robot.pause' as const, id: 'R-001', expectedRevision: 1 };

  expect(authorizeCommand(state, { id: '', role: 'administrator' }, command)).toMatchObject({
    allowed: false,
    code: 'forbidden',
  });
  expect(
    authorizeCommand(
      state,
      { id: 'operator', role: 'operator', facilityIds: ['FAC-002'] },
      command,
    ),
  ).toMatchObject({ allowed: false, code: 'forbidden' });
  expect(
    authorizeCommand(
      state,
      { id: 'operator', role: 'operator', facilityIds: ['FAC-001'] },
      command,
    ),
  ).toEqual({ allowed: true, facilityId: 'FAC-001' });
});

it('does not reveal missing entities to roles that cannot run the command', () => {
  const state = createSeed();
  const command = { type: 'robot.pause' as const, id: 'R-missing', expectedRevision: 1 };

  expect(authorizeCommand(state, { id: 'viewer', role: 'viewer' }, command)).toMatchObject({
    code: 'forbidden',
    reason: 'Your role cannot execute this command',
  });
  expect(
    authorizeCommand(state, { id: 'administrator', role: 'administrator' }, command),
  ).toMatchObject({ code: 'missing', reason: 'Entity no longer exists' });
  let failure: unknown;
  try {
    assertCommandAuthorized(state, { id: 'administrator', role: 'administrator' }, command);
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({ code: 'missing', conflict: undefined });
});
