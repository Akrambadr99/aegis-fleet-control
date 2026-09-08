import { expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import {
  filterOperationalAlerts,
  getMissionExecutionProjection,
  projectOperationalAlerts,
} from './projections';
it('derives scoped alerts from events without duplicating persisted records', () => {
  const state = createSeed();
  state.activity.push({
    id: 'e',
    tick: 0,
    actorId: 'a',
    type: 'robot.stop',
    entityId: 'R-001',
    details: 'Stopped',
    correlationId: 'op',
  });
  const alerts = projectOperationalAlerts(state, state.activity);
  expect(filterOperationalAlerts(alerts, { id: 'a', role: 'operator' })[0].correlationId).toBe(
    'op',
  );
  expect(filterOperationalAlerts(alerts, { id: 'a', role: 'operator', facilityIds: [] })).toEqual(
    [],
  );
  expect(getMissionExecutionProjection(state, 'F-001')).toContain(state.missions['M-001']);
});
