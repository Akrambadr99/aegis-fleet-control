import type { DomainState, Robot } from './model';

/** Immediate dispatch commitments shared by planning and scheduling. */
export function robotCommitments(state: DomainState, robot: Robot): string[] {
  const reasons: string[] = [];
  const active = robot.activeMissionId ? state.missions[robot.activeMissionId] : null;
  if (robot.status !== 'idle' || (active && !['completed', 'cancelled'].includes(active.status)))
    reasons.push('Robot has active mission workload');
  if (
    robot.chargerReservationId &&
    ['queued', 'charging'].includes(state.reservations[robot.chargerReservationId]?.state)
  )
    reasons.push('Charging commitment');
  return reasons;
}
