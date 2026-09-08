import type { DomainState, Mission, Robot } from './model';
import { routeDistance } from './navigation';
import { DomainError } from './errors';

export interface MotionCharacteristics {
  energyPerMeter: number;
  reservePercent: number;
  payloadSpeedPenalty: number;
  payloadEnergyPenalty: number;
}
/** Operational simulation calibration: battery values are percentage points. */
export const defaultMotion: Readonly<MotionCharacteristics> = Object.freeze({
  energyPerMeter: 0.12,
  reservePercent: 20,
  payloadSpeedPenalty: 0.2,
  payloadEnergyPenalty: 0.3,
});
export interface TravelSegment {
  distance: number;
  payloadKg: number;
}
export function motionProfile(robot: Robot, payloadKg = 0) {
  const model = { ...defaultMotion, ...robot.motion };
  if (
    !Number.isFinite(robot.capabilities.maxSpeed) ||
    robot.capabilities.maxSpeed <= 0 ||
    !Number.isFinite(robot.capabilities.payloadKg) ||
    robot.capabilities.payloadKg < 0 ||
    !Number.isFinite(payloadKg) ||
    payloadKg < 0 ||
    !Object.values(model).every(Number.isFinite) ||
    model.energyPerMeter <= 0 ||
    model.reservePercent < 0 ||
    model.reservePercent >= 100 ||
    model.payloadSpeedPenalty < 0 ||
    model.payloadEnergyPenalty < 0
  )
    throw new DomainError('invalid', 'Robot motion characteristics are invalid');
  const load = payloadKg / Math.max(1, robot.capabilities.payloadKg);
  return {
    speed: robot.capabilities.maxSpeed / (1 + load * model.payloadSpeedPenalty),
    energyPerMeter: model.energyPerMeter * (1 + load * model.payloadEnergyPenalty),
    reservePercent: model.reservePercent,
  };
}
function remainingSegments(segments: readonly TravelSegment[], progress: number) {
  if (
    !Number.isFinite(progress) ||
    segments.some((segment) => !Number.isFinite(segment.distance) || segment.distance < 0)
  )
    throw new DomainError('invalid', 'Travel distance and progress must be finite');
  const total = segments.reduce((sum, segment) => sum + segment.distance, 0);
  let consumed = (total * Math.max(0, Math.min(100, progress))) / 100;
  return {
    total,
    segments: segments.map((segment) => {
      const skipped = Math.min(consumed, segment.distance);
      consumed -= skipped;
      return { ...segment, distance: segment.distance - skipped };
    }),
  };
}
export function estimateJourney(robot: Robot, segments: readonly TravelSegment[], progress = 0) {
  const remaining = remainingSegments(segments, progress);
  let distance = 0,
    seconds = 0,
    batteryRequired = 0;
  for (const segment of remaining.segments) {
    const profile = motionProfile(robot, segment.payloadKg);
    distance += segment.distance;
    seconds += segment.distance / profile.speed;
    batteryRequired += segment.distance * profile.energyPerMeter;
  }
  return {
    distance,
    seconds,
    batteryRequired: Number(batteryRequired.toFixed(6)),
    reservePercent: motionProfile(robot).reservePercent,
  };
}
export function advanceJourney(
  robot: Robot,
  segments: readonly TravelSegment[],
  progress: number,
  seconds = 1,
) {
  if (!Number.isFinite(seconds) || seconds <= 0)
    throw new DomainError('invalid', 'Simulation duration must be positive');
  const remaining = remainingSegments(segments, progress);
  let time = seconds,
    distance = 0,
    battery = robot.battery;
  for (const segment of remaining.segments) {
    if (time <= 0) break;
    const profile = motionProfile(robot, segment.payloadKg);
    const availableDistance =
      Math.max(0, battery - profile.reservePercent) / profile.energyPerMeter;
    const moved = Math.min(segment.distance, profile.speed * time, availableDistance);
    distance += moved;
    time -= moved / profile.speed;
    battery -= moved * profile.energyPerMeter;
    if (moved < segment.distance - 1e-9) break;
  }
  const remainingDistance = remaining.segments.reduce((sum, segment) => sum + segment.distance, 0);
  const completed = distance >= remainingDistance - 1e-8;
  return {
    progress: completed
      ? 100
      : Math.min(100, Math.max(0, progress) + (distance / remaining.total) * 100),
    battery: Number(battery.toFixed(6)),
    distance,
    velocity: distance / seconds,
    completed,
  };
}
export function missionTravel(state: DomainState, mission: Mission): TravelSegment[] {
  const distance = routeDistance(state, state.routes[mission.routeId]),
    payloadKg = mission.requirements?.payloadKg ?? 0;
  const job = mission.jobId ? state.jobs[mission.jobId] : null;
  if (!job || payloadKg === 0) return [{ distance, payloadKg }];
  const pickupDistance = (distance * job.pickupProgress) / 100;
  return [
    { distance: pickupDistance, payloadKg: 0 },
    { distance: distance - pickupDistance, payloadKg },
  ];
}
