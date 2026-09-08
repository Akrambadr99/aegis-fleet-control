import { expect, it } from 'vitest';
import { createSeed } from './seed';
import { advanceJourney, estimateJourney, motionProfile } from './motion';
it('unloaded and loaded legs use the same energy and duration under whole or stepped time', () => {
  const robot = createSeed().robots['R-004'];
  robot.battery = 100;
  robot.capabilities.payloadKg = 100;
  const segments = [
    { distance: 12, payloadKg: 0 },
    { distance: 12, payloadKg: 100 },
  ];
  const estimate = estimateJourney(robot, segments);
  expect(estimate.seconds).toBeCloseTo(22);
  expect(estimate.batteryRequired).toBeCloseTo(3.312);
  const whole = advanceJourney(robot, segments, 0, 22);
  let progress = 0;
  const stepped = structuredClone(robot);
  for (let tick = 0; tick < 22; tick++) {
    const step = advanceJourney(stepped, segments, progress);
    progress = step.progress;
    stepped.battery = step.battery;
  }
  expect(progress).toBe(100);
  expect(whole.completed).toBe(true);
  expect(stepped.battery).toBeCloseTo(96.688, 5);
  expect(stepped.battery).toBeCloseTo(whole.battery, 5);
});
it('clips travel exactly at battery reserve and never creates negative energy or extra movement', () => {
  const robot = createSeed().robots['R-004'];
  robot.battery = 20.06;
  const segments = [{ distance: 5, payloadKg: 0 }];
  const first = advanceJourney(robot, segments, 0);
  expect(first.distance).toBeCloseTo(0.5);
  expect(first.battery).toBe(20);
  expect(first.completed).toBe(false);
  const second = advanceJourney({ ...robot, battery: first.battery }, segments, first.progress);
  expect(second.distance).toBe(0);
  expect(second.progress).toBeCloseTo(first.progress);
});
it('changes in speed affect duration while payload affects both energy and speed', () => {
  const robot = createSeed().robots['R-004'];
  const unloaded = estimateJourney(robot, [{ distance: 60, payloadKg: 0 }]);
  const loaded = estimateJourney(robot, [{ distance: 60, payloadKg: 100 }]);
  expect(loaded.seconds).toBeGreaterThan(unloaded.seconds);
  expect(loaded.batteryRequired).toBeGreaterThan(unloaded.batteryRequired);
  robot.capabilities.maxSpeed *= 2;
  expect(estimateJourney(robot, [{ distance: 60, payloadKg: 0 }]).seconds).toBeCloseTo(
    unloaded.seconds / 2,
  );
  expect(estimateJourney(robot, [{ distance: 60, payloadKg: 0 }]).batteryRequired).toBe(
    unloaded.batteryRequired,
  );
});
it('rejects invalid motion profiles instead of producing non-finite canonical state', () => {
  const robot = createSeed().robots['R-004'];
  robot.capabilities.maxSpeed = 0;
  expect(() => motionProfile(robot)).toThrow('motion characteristics');
});
