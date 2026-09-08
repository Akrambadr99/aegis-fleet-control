import type { DomainState } from './model';
import { seedNavigation } from './navigation';
import { seedMaintenance } from './maintenance';
const key = (prefix: string, n: number) => `${prefix}-${String(n).padStart(3, '0')}`;
export function createSeed(): DomainState {
  const state: DomainState = {
    revision: 1,
    tick: 0,
    facilities: {},
    floors: {},
    zones: {},
    corridors: {},
    navigationNodes: {},
    navigationEdges: {},
    robots: {},
    missions: {},
    routes: {},
    chargers: {},
    reservations: {},
    faults: {},
    leases: {},
    maintenance: {},
    plans: {},
    activity: [],
    replay: [],
    telemetry: [],
  };
  const names = [
    'Northstar Logistics',
    'Meridian Assembly',
    'Atlas Distribution',
    'Harbor Fulfillment',
  ];
  for (let f = 0; f < 4; f++) {
    const facilityId = key('FAC', f + 1);
    state.facilities[facilityId] = {
      id: facilityId,
      revision: 1,
      name: names[f],
      floorIds: [],
      topologyRevision: 1,
    };
    for (let level = 0; level < 3; level++) {
      const floorId = key('F', f * 3 + level + 1);
      const floor = (state.floors[floorId] = {
        id: floorId,
        revision: 1,
        facilityId,
        name: `Floor ${level + 1}`,
        zoneIds: [] as string[],
        corridorIds: [] as string[],
      });
      state.facilities[facilityId].floorIds.push(floorId);
      for (let z = 0; z < 10; z++) {
        const id = key('Z', f * 30 + level * 10 + z + 1);
        floor.zoneIds.push(id);
        state.zones[id] = {
          id,
          revision: 1,
          floorId,
          name: `Station ${z + 1}`,
          x: 60 + (z % 5) * 120,
          y: 70 + Math.floor(z / 5) * 180,
        };
      }
      for (let c = 0; c < 3; c++) {
        const id = key('C', f * 9 + level * 3 + c + 1);
        floor.corridorIds.push(id);
        state.corridors[id] = {
          id,
          revision: 1,
          floorId,
          name: ['Inbound spine', 'Transfer lane', 'Outbound spine'][c],
          open: true,
          length: 100 + c * 30,
        };
      }
      for (let c = 0; c < 3; c++) {
        const id = key('CHG', f * 9 + level * 3 + c + 1);
        state.chargers[id] = {
          id,
          revision: 1,
          floorId,
          facilityId,
          name: `Charger ${c + 1}`,
          available: true,
        };
      }
      for (let r = 0; r < 10; r++) {
        const n = f * 30 + level * 10 + r + 1,
          id = key('R', n),
          missionId = key('M', n),
          routeId = key('RT', n);
        const faultId = r === 8 ? key('FLT', n) : null;
        state.robots[id] = {
          capabilities: {
            payloadKg: 100 + (n % 4) * 100,
            actions: n % 2 === 0 ? ['navigate', 'lift', 'inspect'] : ['navigate', 'inspect'],
            maxSpeed: 1.2,
          },
          maintenanceOrderId: null,
          id,
          revision: 1,
          facilityId,
          floorId,
          position: { x: 60 + r * 50, y: 175 },
          status: faultId || r === 9 ? 'paused' : 'running',
          battery: 25 + ((n * 7) % 70),
          connected: r !== 9,
          activeMissionId: missionId,
          chargerReservationId: r < 3 ? key('RES', n) : null,
          controlSessionId: null,
          faultIds: faultId ? [faultId] : [],
        };
        state.missions[missionId] = {
          id: missionId,
          revision: 1,
          robotId: id,
          facilityId,
          destinationId: floor.zoneIds[9],
          routeId,
          status: faultId || r === 9 ? 'paused' : 'running',
          priority: 1 + (n % 3),
          progress: n % 50,
          pauseReason: faultId ? 'Active fault' : r === 9 ? 'Connection lost' : null,
        };
        state.missions[key('M', n + 120)] = {
          ...state.missions[missionId],
          id: key('M', n + 120),
          status: 'completed',
          progress: 100,
          pauseReason: null,
        };
        state.routes[routeId] = {
          nodeIds: [],
          edgeIds: [],
          id: routeId,
          revision: 1,
          robotId: id,
          facilityId,
          corridorIds: [floor.corridorIds[r % 3]],
          topologyRevision: 1,
          state: 'valid',
          reservationState: faultId || r === 9 ? 'held' : 'active',
        };
        if (r < 3) {
          const reservationId = key('RES', n);
          state.reservations[reservationId] = {
            id: reservationId,
            revision: 1,
            robotId: id,
            chargerId: key('CHG', f * 9 + level * 3 + 1),
            state: 'queued',
            priority: 4 - r,
            queuePosition: r,
          };
        }
        if (faultId)
          state.faults[faultId] = {
            id: faultId,
            revision: 1,
            robotId: id,
            severity: 'critical',
            status: 'active',
            message: 'Localization confidence below threshold',
            acknowledgedBy: null,
          };
        for (let t = -4; t <= 0; t++)
          state.telemetry.push({
            robotId: id,
            tick: t,
            battery: state.robots[id].battery,
            x: state.robots[id].position.x,
            y: 175,
            velocity: 0,
          });
        for (let e = 0; e < 2; e++)
          state.activity.push({
            id: `seed-${n}-${e}`,
            tick: 0,
            actorId: 'system',
            type: e ? 'mission.assigned' : 'robot.connected',
            entityId: id,
            details: `${id} joined ${facilityId}`,
          });
      }
    }
  }
  seedNavigation(state);
  seedMaintenance(state);
  return state;
}
