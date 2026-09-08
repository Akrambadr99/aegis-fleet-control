export type Role = 'viewer' | 'operator' | 'fleet-manager' | 'facility-manager' | 'administrator';
export interface Actor {
  id: string;
  role: Role;
  facilityIds?: string[];
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
export interface NavigationNode extends Versioned {
  facilityId: string;
  floorId: string;
  position: { x: number; y: number };
  zoneId: string | null;
}
export interface NavigationEdge extends Versioned {
  from: string;
  to: string;
  corridorId: string | null;
  distance: number;
  enabled: boolean;
  bidirectional: boolean;
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
  | 'manual'
  | 'maintenance';
export interface MaintenanceOrder extends Versioned {
  robotId: string;
  status: 'scheduled' | 'in-progress' | 'verification' | 'completed';
  dueTick: number;
  technician: string;
}
export interface Robot extends Versioned {
  capabilities: { payloadKg: number; actions: string[]; maxSpeed: number };
  maintenanceOrderId: string | null;
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
  requirements?: { payloadKg: number; actions: string[] };
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
  nodeIds: string[];
  edgeIds: string[];
  origin?: { x: number; y: number };
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
  state: 'queued' | 'charging' | 'displaced' | 'released';
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
export interface AuditChange {
  kind: string;
  entityId: string;
  previous: Versioned | null;
  next: Versioned;
}
export interface Activity {
  id: string;
  tick: number;
  actorId: string;
  type: string;
  entityId: string;
  details: string;
  timestamp?: string;
  actorRole?: Role;
  reason?: string;
  changes?: AuditChange[];
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
  navigationNodes: Record<string, NavigationNode>;
  navigationEdges: Record<string, NavigationEdge>;
  robots: Record<string, Robot>;
  missions: Record<string, Mission>;
  routes: Record<string, Route>;
  chargers: Record<string, Charger>;
  reservations: Record<string, Reservation>;
  faults: Record<string, Fault>;
  leases: Record<string, ControlLease>;
  maintenance: Record<string, MaintenanceOrder>;
  activity: Activity[];
  replay: ReplayFrame[];
  telemetry: Telemetry[];
}
export type Command =
  | {
      type: 'maintenance.start' | 'maintenance.verify' | 'maintenance.complete';
      id: string;
      expectedRevision: number;
    }
  | { type: 'corridor.set'; id: string; expectedRevision: number; open: boolean }
  | { type: 'charger.set'; id: string; expectedRevision: number; available: boolean }
  | {
      type: 'robot.stop' | 'robot.pause' | 'robot.resume' | 'robot.reroute';
      id: string;
      expectedRevision: number;
    }
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
