import { expect, it } from 'vitest';
import { createSeed } from './seed';
import { shortestPath, robotPath, positionOnRoute } from './navigation';
it('finds a multi-edge destination route with the same cost used by mission estimates', () => {
  const s = createSeed();
  s.missions['M-001'].destinationId = 'Z-001';
  const path = robotPath(s, 'R-001')!;
  expect(path.nodeIds).toEqual(['F-001-IN', 'F-001-OUT', 'Z-001-NODE']);
  expect(path.distance).toBe(120);
  expect(path.corridorIds).toEqual(['C-001']);
});
it('respects one-way travel', () => {
  const s = createSeed();
  expect(shortestPath(s, 'F-001-OUT', 'F-001-IN')).toBeNull();
  s.navigationEdges['C-001-EDGE'].bidirectional = true;
  expect(shortestPath(s, 'F-001-OUT', 'F-001-IN')?.distance).toBe(100);
});
it('does not route across unrelated facilities', () => {
  const s = createSeed();
  expect(shortestPath(s, 'F-001-IN', 'F-004-OUT')).toBeNull();
});
it('chooses an open alternate lane and reports disconnection when none remains', () => {
  const s = createSeed();
  s.corridors['C-001'].open = false;
  expect(robotPath(s, 'R-001')?.corridorIds).toEqual(['C-002']);
  s.corridors['C-002'].open = false;
  s.corridors['C-003'].open = false;
  expect(robotPath(s, 'R-001')).toBeNull();
});
it('ignores disabled navigation edges independently of corridor state', () => {
  const s = createSeed();
  s.navigationEdges['C-001-EDGE'].enabled = false;
  expect(robotPath(s, 'R-001')?.corridorIds).toEqual(['C-002']);
});
it('seed telemetry and robot positions lie on the assigned route', () => {
  const s = createSeed();
  for (const robot of Object.values(s.robots)) {
    const mission = s.missions[robot.activeMissionId!];
    expect(robot.position).toEqual(positionOnRoute(s, s.routes[mission.routeId], mission.progress));
  }
  expect(s.telemetry[0].x).toBe(s.robots['R-001'].position.x);
});
it('completed mission routes are independent from active routes', () => {
  const s = createSeed();
  const live = s.missions['M-001'],
    history = s.missions['M-121'];
  expect(history.routeId).not.toBe(live.routeId);
  expect(s.routes[history.routeId].reservationState).toBe('released');
});
it('zero-hop and missing-node paths are defined', () => {
  const s = createSeed();
  expect(shortestPath(s, 'F-001-IN', 'F-001-IN')?.distance).toBe(0);
  expect(shortestPath(s, 'missing', 'F-001-IN')).toBeNull();
});
