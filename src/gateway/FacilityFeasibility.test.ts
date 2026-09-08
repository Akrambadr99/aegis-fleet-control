import { expect, it } from 'vitest';
import { createSeed } from '../domain/seed';
import { newPlan, newStep, validatePlan } from '../domain/planning';

it('rejects unreachable facility resources even when the resource is available', () => {
  const state = createSeed(),
    plan = newPlan('P', 'FAC-001', 'R-001');
  const resource = Object.values(state.resources).find(
    (entry) => entry.facilityId === plan.facilityId && entry.kind === 'dock',
  )!;
  plan.steps = [{ ...newStep('dock', 'dock'), resourceId: resource.id }];
  expect(validatePlan(state, plan).issues).toEqual([]);
  for (const edge of Object.values(state.navigationEdges)) edge.enabled = false;
  expect(resource.available).toBe(true);
  expect(validatePlan(state, plan).issues.map((issue) => issue.message)).toContain(
    'Resource is unreachable through the current topology',
  );
});

it('resource capacity affects immediate dispatch while released owners no longer block', () => {
  const state = createSeed(),
    plan = newPlan('P', 'FAC-001', 'R-001');
  const resource = Object.values(state.resources).find(
    (entry) => entry.facilityId === plan.facilityId && entry.kind === 'dock',
  )!;
  plan.steps = [{ ...newStep('dock', 'dock'), resourceId: resource.id }];
  resource.capacity = 1;
  state.resourceReservations.TEST = {
    id: 'TEST',
    revision: 1,
    resourceId: resource.id,
    robotId: 'R-002',
    missionId: null,
    state: 'owned',
    priority: 1,
    requestedTick: 0,
    expiresTick: 100,
    duration: 100,
  };
  expect(validatePlan(state, plan).dispatchIssues).toContain(
    'Resource ' + resource.id + ' is at capacity',
  );
  state.resourceReservations.TEST.state = 'released';
  expect(validatePlan(state, plan).dispatchIssues).not.toContain(
    'Resource ' + resource.id + ' is at capacity',
  );
});

it('charging requires reachable facilities and positive service time, with occupancy reported separately', () => {
  const state = createSeed(),
    plan = newPlan('P', 'FAC-001', 'R-001');
  plan.steps = [{ ...newStep('charge', 'charge'), chargerId: 'CHG-001', seconds: 10 }];
  expect(validatePlan(state, plan).issues).toEqual([]);
  state.reservations['RES-002'].state = 'charging';
  expect(validatePlan(state, plan).dispatchIssues).toContain('Charger CHG-001 is occupied');
  plan.steps[0].seconds = 0;
  expect(validatePlan(state, plan).issues.map((issue) => issue.message)).toContain(
    'Charging duration must be positive',
  );
  state.chargers['CHG-001'].floorId = 'F-UNKNOWN';
  expect(validatePlan(state, plan).issues.map((issue) => issue.message)).toContain(
    'Charger floor is unreachable through the current topology',
  );
});
