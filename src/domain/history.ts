import type { DomainState, Robot, Mission, Route, Fault } from './model';
export interface RobotHistory {
  sequence: number;
  tick: number;
  robotId: string;
  facilityId: string;
  floorId: string;
  position: Robot['position'];
  status: Robot['status'];
  battery: number;
  velocity: number;
  missionId: string | null;
  missionStatus: Mission['status'] | null;
  missionProgress: number | null;
  routeReservation: Route['reservationState'] | null;
  topologyRevision: number;
  faults: { id: string; status: Fault['status']; message: string }[];
  resources: string[];
  controlOwner: string | null;
  eventId: string | null;
}
export function appendHistory(state: DomainState, robots: Robot[], eventId: string | null = null) {
  const latestTelemetry = new Map(state.telemetry.map((t) => [t.robotId, t]));
  const owned = new Map<string, string[]>();
  for (const lease of Object.values(state.resourceReservations))
    if (lease.state === 'owned')
      owned.set(lease.robotId, [...(owned.get(lease.robotId) ?? []), lease.resourceId]);
  for (const robot of new Map(robots.map((r) => [r.id, r])).values()) {
    const mission = robot.activeMissionId ? state.missions[robot.activeMissionId] : null,
      route = mission ? state.routes[mission.routeId] : null,
      control = robot.controlSessionId ? state.leases[robot.controlSessionId] : null;
    state.history.push({
      sequence: ++state.historySequence,
      tick: state.tick,
      robotId: robot.id,
      facilityId: robot.facilityId,
      floorId: robot.floorId,
      position: { ...robot.position },
      status: robot.status,
      battery: robot.battery,
      velocity: latestTelemetry.get(robot.id)?.velocity ?? 0,
      missionId: mission?.id ?? null,
      missionStatus: mission?.status ?? null,
      missionProgress: mission?.progress ?? null,
      routeReservation: route?.reservationState ?? null,
      topologyRevision: state.facilities[robot.facilityId].topologyRevision,
      faults: robot.faultIds.map((id) => ({
        id,
        status: state.faults[id].status,
        message: state.faults[id].message,
      })),
      resources: [...(owned.get(robot.id) ?? [])],
      controlOwner: control?.state === 'active' ? control.ownerId : null,
      eventId,
    });
  }
  state.history = state.history.slice(-60000);
}
export function robotHistory(state: DomainState, robotId: string, missionId?: string) {
  return state.history.filter(
    (f) => f.robotId === robotId && (!missionId || f.missionId === missionId),
  );
}
export function historyAtTick(frames: RobotHistory[], tick: number) {
  let low = 0,
    high = frames.length - 1,
    result: RobotHistory | undefined;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (frames[mid].tick <= tick) {
      result = frames[mid];
      low = mid + 1;
    } else high = mid - 1;
  }
  return result;
}
