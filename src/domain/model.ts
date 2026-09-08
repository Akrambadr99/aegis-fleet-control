export type Role = 'viewer' | 'operator' | 'fleet-manager' | 'facility-manager' | 'administrator';
export interface Actor {
  id: string;
  role: Role;
}
export interface Versioned {
  id: string;
  revision: number;
}
export interface Facility extends Versioned {
  name: string;
  floorIds: string[];
  topologyRevision: number;
}
export interface Floor extends Versioned {
  facilityId: string;
  name: string;
  zoneIds: string[];
  corridorIds: string[];
}
export interface Zone extends Versioned {
  floorId: string;
  name: string;
  x: number;
  y: number;
}
export interface Corridor extends Versioned {
  floorId: string;
  name: string;
  open: boolean;
  length: number;
}
export type RobotStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'charging'
  | 'emergency-stopped'
  | 'manual';
export interface Robot extends Versioned {
  facilityId: string;
  floorId: string;
  position: { x: number; y: number };
  status: RobotStatus;
  battery: number;
  connected: boolean;
  activeMissionId: string | null;
  chargerReservationId: string | null;
  controlSessionId: string | null;
  faultIds: string[];
}
export interface Mission extends Versioned {
  robotId: string;
  facilityId: string;
  destinationId: string;
  routeId: string;
  status: 'running' | 'paused' | 'completed' | 'draft';
  priority: number;
  progress: number;
  pauseReason: string | null;
}
export interface Route extends Versioned {
  robotId: string;
  facilityId: string;
  corridorIds: string[];
  topologyRevision: number;
  state: 'valid' | 'invalid';
  reservationState: 'active' | 'held' | 'released';
}
export interface Charger extends Versioned {
  floorId: string;
  facilityId: string;
  available: boolean;
  name: string;
}
export interface Reservation extends Versioned {
  robotId: string;
  chargerId: string;
  state: 'queued' | 'charging' | 'displaced';
  priority: number;
  queuePosition: number;
}
export interface Fault extends Versioned {
  robotId: string;
  severity: 'warning' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  message: string;
  acknowledgedBy: string | null;
}
export interface ControlLease extends Versioned {
  robotId: string;
  ownerId: string;
  expiresAt: number;
  state: 'active' | 'released';
}
export interface Activity {
  id: string;
  tick: number;
  actorId: string;
  type: string;
  entityId: string;
  details: string;
}
export interface ReplayFrame {
  tick: number;
  robotId: string;
  status: RobotStatus;
  missionStatus: Mission['status'] | null;
  position: Robot['position'];
  battery: number;
  routeReservation: Route['reservationState'] | null;
  eventId: string;
}
export interface Telemetry {
  robotId: string;
  tick: number;
  battery: number;
  x: number;
  y: number;
  velocity: number;
}
export interface DomainState {
  revision: number;
  tick: number;
  facilities: Record<string, Facility>;
  floors: Record<string, Floor>;
  zones: Record<string, Zone>;
  corridors: Record<string, Corridor>;
  robots: Record<string, Robot>;
  missions: Record<string, Mission>;
  routes: Record<string, Route>;
  chargers: Record<string, Charger>;
  reservations: Record<string, Reservation>;
  faults: Record<string, Fault>;
  leases: Record<string, ControlLease>;
  activity: Activity[];
  replay: ReplayFrame[];
  telemetry: Telemetry[];
}
export type Command =
  | { type: 'corridor.set'; id: string; expectedRevision: number; open: boolean }
  | { type: 'charger.set'; id: string; expectedRevision: number; available: boolean }
  | { type: 'robot.stop' | 'robot.pause' | 'robot.resume'; id: string; expectedRevision: number }
  | { type: 'fault.acknowledge'; id: string; expectedRevision: number };
export interface RoutePreview {
  robotId: string;
  robotRevision: number;
  topologyRevision: number;
  corridorIds: string[];
  distance: number;
  batteryRequired: number;
  feasible: boolean;
  reasons: string[];
}
