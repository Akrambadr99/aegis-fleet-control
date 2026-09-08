import type { DomainState } from './model';
import { motionProfile } from './motion';
import { DomainError as GatewayError } from './errors';

export interface InvariantViolation {
  entityId: string;
  rule: string;
}
export function inspectInvariants(state: DomainState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const check = (condition: unknown, entityId: string, rule: string) => {
    if (!condition) violations.push({ entityId, rule });
  };
  for (const robot of Object.values(state.robots)) {
    check(
      Number.isFinite(robot.battery) && robot.battery >= 0 && robot.battery <= 100,
      robot.id,
      'Robot battery must be a bounded percentage',
    );
    try {
      motionProfile(robot);
    } catch {
      check(false, robot.id, 'Robot motion characteristics must be valid');
    }
    check(
      state.floors[robot.floorId]?.facilityId === robot.facilityId,
      robot.id,
      'Robot floor must belong to its facility',
    );
    if (robot.activeMissionId) {
      const mission = state.missions[robot.activeMissionId];
      check(
        mission?.robotId === robot.id && mission?.facilityId === robot.facilityId,
        robot.id,
        'Active mission ownership must agree',
      );
      check(
        mission && !['completed', 'cancelled'].includes(mission.status),
        robot.id,
        'Closed mission cannot remain active',
      );
    }
    if (robot.chargerReservationId) {
      const reservation = state.reservations[robot.chargerReservationId];
      check(
        reservation?.robotId === robot.id && reservation.state !== 'released',
        robot.id,
        'Attached charging reservation must be owned and unreleased',
      );
    }
    if (robot.controlSessionId) {
      const lease = state.leases[robot.controlSessionId];
      check(
        lease?.robotId === robot.id && lease.state === 'active',
        robot.id,
        'Attached control lease must be active and owned',
      );
    }
    const activeLeases = Object.values(state.leases).filter(
      (lease) => lease.robotId === robot.id && lease.state === 'active',
    );
    check(activeLeases.length <= 1, robot.id, 'Robot cannot have competing active control leases');
    const maintenance = robot.maintenanceOrderId
      ? state.maintenance[robot.maintenanceOrderId]
      : undefined;
    if (
      robot.status === 'maintenance' ||
      (maintenance && ['in-progress', 'verification'].includes(maintenance.status))
    ) {
      check(
        !Object.values(state.routes).some(
          (route) => route.robotId === robot.id && route.reservationState === 'active',
        ),
        robot.id,
        'Maintenance cannot own active traffic',
      );
    }
    for (const id of robot.faultIds)
      check(state.faults[id]?.robotId === robot.id, robot.id, 'Fault ownership must agree');
  }
  for (const mission of Object.values(state.missions)) {
    const route = state.routes[mission.routeId];
    check(
      state.robots[mission.robotId] &&
        route?.robotId === mission.robotId &&
        route.facilityId === mission.facilityId,
      mission.id,
      'Mission robot and route must agree',
    );
  }
  for (const route of Object.values(state.routes)) {
    check(
      state.facilities[route.facilityId] && state.robots[route.robotId],
      route.id,
      'Route references must exist',
    );
    for (const id of route.nodeIds)
      check(
        state.navigationNodes[id]?.facilityId === route.facilityId,
        route.id,
        'Route nodes must belong to its facility',
      );
    for (const id of route.edgeIds)
      check(state.navigationEdges[id], route.id, 'Route edges must exist');
  }
  for (const reservation of Object.values(state.reservations))
    check(
      state.robots[reservation.robotId] && state.chargers[reservation.chargerId],
      reservation.id,
      'Charging references must exist',
    );
  for (const reservation of Object.values(state.resourceReservations))
    check(
      state.robots[reservation.robotId] &&
        state.resources[reservation.resourceId] &&
        (!reservation.missionId || state.missions[reservation.missionId]),
      reservation.id,
      'Resource reservation references must exist',
    );

  for (const lease of Object.values(state.leases)) {
    check(state.robots[lease.robotId], lease.id, 'Control lease robot must exist');
    if (lease.state === 'active')
      check(
        state.robots[lease.robotId]?.controlSessionId === lease.id,
        lease.id,
        'Active control lease must be attached to its robot',
      );
  }
  for (const order of Object.values(state.maintenance))
    check(state.robots[order.robotId], order.id, 'Maintenance robot must exist');
  for (const job of Object.values(state.jobs)) {
    check(state.facilities[job.facilityId], job.id, 'Job facility must exist');
    if (job.dispatchLock?.state === 'active')
      check(
        !!job.dispatchLock.ownerId &&
          Number.isFinite(job.dispatchLock.expiresAt) &&
          job.dispatchLock.expiresAt > state.tick &&
          !['completed', 'cancelled'].includes(job.status),
        job.id,
        'Dispatch ownership must be live and belong to an open job',
      );
    if (job.groupId)
      check(
        state.jobGroups[job.groupId]?.jobIds.includes(job.id) &&
          state.jobGroups[job.groupId]?.facilityId === job.facilityId,
        job.id,
        'Job group membership must agree',
      );
    check(
      new Set(job.attempts?.map((attempt) => attempt.missionId)).size ===
        (job.attempts?.length ?? 0),
      job.id,
      'Job attempts must have unique missions',
    );
    for (const attempt of job.attempts ?? []) {
      check(
        state.missions[attempt.missionId]?.jobId === job.id &&
          state.missions[attempt.missionId]?.robotId === attempt.robotId,
        job.id,
        'Job attempt mission and robot must agree',
      );
      check(
        Number.isInteger(attempt.units) && attempt.units > 0,
        job.id,
        'Job attempt units must be positive integers',
      );
      if (attempt.outcome === 'active')
        check(
          job.missionId === attempt.missionId && job.robotId === attempt.robotId,
          job.id,
          'Active job attempt must own current assignment',
        );
    }
    for (const id of job.dependsOn)
      check(
        state.jobs[id]?.facilityId === job.facilityId,
        job.id,
        'Job dependency must exist in the same facility',
      );
    if (job.robotId)
      check(
        state.robots[job.robotId]?.facilityId === job.facilityId,
        job.id,
        'Assigned job robot must belong to its facility',
      );
    if (job.missionId)
      check(
        state.missions[job.missionId]?.jobId === job.id,
        job.id,
        'Job mission must reference its job',
      );
  }
  for (const group of Object.values(state.jobGroups)) {
    check(
      state.facilities[group.facilityId] &&
        group.jobIds.length > 0 &&
        new Set(group.jobIds).size === group.jobIds.length,
      group.id,
      'Dispatch group must have distinct jobs and a facility',
    );
    for (const id of group.jobIds)
      check(
        state.jobs[id]?.groupId === group.id && state.jobs[id]?.facilityId === group.facilityId,
        group.id,
        'Dispatch group members must reference the group',
      );
    if (group.status === 'closed')
      check(
        group.jobIds.every((id) => ['completed', 'cancelled'].includes(state.jobs[id]?.status)),
        group.id,
        'Closed groups cannot contain unfinished jobs',
      );
  }
  for (const mission of Object.values(state.missions)) {
    if (mission.planId)
      check(
        state.plans[mission.planId]?.robotId === mission.robotId,
        mission.id,
        'Mission plan robot must agree',
      );
    if (mission.jobId) check(state.jobs[mission.jobId], mission.id, 'Mission job must exist');
  }
  return violations;
}
export function assertInvariants(state: DomainState) {
  const violations = inspectInvariants(state);
  if (violations.length)
    throw new GatewayError(
      'invariant',
      violations.map((violation) => violation.entityId + ': ' + violation.rule).join('; '),
    );
}
