import { expect, it } from 'vitest';
import { supportsRobotAction } from './capabilities';
import { createSeed } from './seed';
it('applies the same action and payload boundary to scheduling and mission steps', () => {
  const robot = createSeed().robots['R-001'];
  robot.capabilities.actions = ['lift'];
  robot.capabilities.payloadKg = 50;
  expect(supportsRobotAction(robot, 'lift', 50)).toBe(true);
  expect(supportsRobotAction(robot, 'lift', 51)).toBe(false);
  expect(supportsRobotAction(robot, 'navigate')).toBe(false);
});
