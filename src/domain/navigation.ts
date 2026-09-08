import type { DomainState, NavigationNode, Route } from './model';
export interface PathResult {
  nodeIds: string[];
  edgeIds: string[];
  corridorIds: string[];
  distance: number;
}
export function nearestNavigationNode(
  state: DomainState,
  floorId: string,
  position: { x: number; y: number },
) {
  return Object.values(state.navigationNodes)
    .filter((node) => node.floorId === floorId)
    .sort(
      (a, b) =>
        Math.hypot(a.position.x - position.x, a.position.y - position.y) -
          Math.hypot(b.position.x - position.x, b.position.y - position.y) ||
        a.id.localeCompare(b.id),
    )[0];
}
export function shortestPath(state: DomainState, from: string, to: string): PathResult | null {
  const origin = state.navigationNodes[from],
    target = state.navigationNodes[to];
  if (!origin || !target || origin.facilityId !== target.facilityId) return null;
  const blockedResources = new Set(
    Object.values(state.resources)
      .filter((r) => !r.available && r.corridorId)
      .map((r) => r.corridorId),
  );
  const distances = new Map<string, number>([[from, 0]]),
    previous = new Map<string, { node: string; edge: string }>(),
    visited = new Set<string>();
  while (true) {
    const entry = [...distances]
      .filter(([id]) => !visited.has(id))
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0];
    if (!entry) return null;
    const [id, distance] = entry;
    if (id === to) break;
    visited.add(id);
    for (const edge of Object.values(state.navigationEdges).sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      if (
        !edge.enabled ||
        edge.distance <= 0 ||
        (edge.corridorId &&
          (!state.corridors[edge.corridorId]?.open || blockedResources.has(edge.corridorId)))
      )
        continue;
      const next =
        edge.from === id ? edge.to : edge.bidirectional && edge.to === id ? edge.from : null;
      if (
        !next ||
        visited.has(next) ||
        state.navigationNodes[next]?.facilityId !== origin.facilityId
      )
        continue;
      const cost = distance + edge.distance;
      if (cost < (distances.get(next) ?? Infinity)) {
        distances.set(next, cost);
        previous.set(next, { node: id, edge: edge.id });
      }
    }
  }
  const nodeIds = [to],
    edgeIds: string[] = [];
  let cursor = to;
  while (cursor !== from) {
    const step = previous.get(cursor)!;
    edgeIds.unshift(step.edge);
    nodeIds.unshift(step.node);
    cursor = step.node;
  }
  return {
    nodeIds,
    edgeIds,
    corridorIds: [
      ...new Set(
        edgeIds
          .map((id) => state.navigationEdges[id].corridorId)
          .filter((id): id is string => !!id),
      ),
    ],
    distance: distances.get(to)!,
  };
}
export function robotPath(state: DomainState, robotId: string): PathResult | null {
  const robot = state.robots[robotId],
    mission = robot.activeMissionId ? state.missions[robot.activeMissionId] : null;
  if (!mission) return null;
  const current = state.routes[mission.routeId];
  const destination = Object.values(state.navigationNodes).find(
    (node) => node.zoneId === mission.destinationId,
  );
  return destination ? shortestPath(state, current.nodeIds[0], destination.id) : null;
}
export function routeDistance(state: DomainState, route: Route) {
  return route.edgeIds.reduce((sum, id) => sum + state.navigationEdges[id].distance, 0);
}
export function positionOnRoute(state: DomainState, route: Route, progress: number) {
  if (!route.nodeIds.length) return { x: 0, y: 0 };
  const total = routeDistance(state, route);
  let remaining = (total * Math.max(0, Math.min(100, progress))) / 100;
  for (let i = 0; i < route.edgeIds.length; i++) {
    const edge = state.navigationEdges[route.edgeIds[i]],
      from =
        i === 0 && route.origin ? route.origin : state.navigationNodes[route.nodeIds[i]].position,
      to = state.navigationNodes[route.nodeIds[i + 1]].position;
    if (remaining <= edge.distance) {
      const fraction = remaining / edge.distance;
      return {
        x: Number((from.x + (to.x - from.x) * fraction).toFixed(2)),
        y: Number((from.y + (to.y - from.y) * fraction).toFixed(2)),
      };
    }
    remaining -= edge.distance;
  }
  return { ...state.navigationNodes[route.nodeIds.at(-1)!].position };
}
export function seedNavigation(state: DomainState) {
  for (const floor of Object.values(state.floors)) {
    const start = floor.id + '-IN',
      end = floor.id + '-OUT',
      zone = state.zones[floor.zoneIds.at(-1)!];
    const add = (id: string, position: NavigationNode['position'], zoneId: string | null) => {
      state.navigationNodes[id] = {
        id,
        revision: 1,
        floorId: floor.id,
        facilityId: floor.facilityId,
        position,
        zoneId,
      };
    };
    add(start, { x: 40, y: 175 }, null);
    add(end, { x: zone.x, y: zone.y }, zone.id);
    for (const id of floor.corridorIds) {
      const corridor = state.corridors[id];
      state.navigationEdges[id + '-EDGE'] = {
        id: id + '-EDGE',
        revision: 1,
        from: start,
        to: end,
        corridorId: id,
        distance: corridor.length,
        enabled: true,
        bidirectional: false,
      };
    }
    for (const id of floor.zoneIds.slice(0, -1)) {
      const destination = state.zones[id],
        nodeId = id + '-NODE';
      add(nodeId, { x: destination.x, y: destination.y }, id);
      state.navigationEdges[id + '-ACCESS'] = {
        id: id + '-ACCESS',
        revision: 1,
        from: end,
        to: nodeId,
        corridorId: null,
        distance: 20 + floor.zoneIds.indexOf(id) * 5,
        enabled: true,
        bidirectional: true,
      };
    }
  }
  for (const route of Object.values(state.routes)) {
    const floor = state.floors[state.robots[route.robotId].floorId];
    route.nodeIds = [floor.id + '-IN', floor.id + '-OUT'];
    route.edgeIds = route.corridorIds.map((id) => id + '-EDGE');
  }
  for (const robot of Object.values(state.robots)) {
    const mission = state.missions[robot.activeMissionId!],
      route = state.routes[mission.routeId];
    robot.position = positionOnRoute(state, route, mission.progress);
  }
  // Completed missions retain their own route snapshots; live route changes cannot alter history.
  for (const mission of Object.values(state.missions).filter((m) => m.status === 'completed')) {
    const old = state.routes[mission.routeId],
      id = 'HIST-' + mission.id;
    state.routes[id] = { ...structuredClone(old), id, reservationState: 'released' };
    mission.routeId = id;
  }
  for (const sample of state.telemetry) {
    const robot = state.robots[sample.robotId];
    sample.x = robot.position.x;
    sample.y = robot.position.y;
  }
}
