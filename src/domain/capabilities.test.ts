import { expect, it } from 'vitest';
import { supportsRobotAction, supportsMissionAction } from './capabilities';
import { createSeed } from './seed';
it('applies the same action and payload boundary to scheduling and mission steps', () => {
  const robot = createSeed().robots['R-001'];
  robot.capabilities.actions = ['lift'];
  robot.capabilities.payloadKg = 50;
  expect(supportsRobotAction(robot, 'lift', 50)).toBe(true);
  expect(supportsRobotAction(robot, 'lift', 51)).toBe(false);
  expect(supportsRobotAction(robot, 'navigate')).toBe(false);
});

it('maps mission pickup and dropoff to the same underlying robot capability', () => {
  const robot = createSeed().robots['R-001'];
  robot.capabilities.actions = ['lift'];
  robot.capabilities.payloadKg = 50;
  expect(supportsMissionAction(robot, 'pickup', 50)).toBe(true);
  expect(supportsMissionAction(robot, 'dropoff', 51)).toBe(false);
});
