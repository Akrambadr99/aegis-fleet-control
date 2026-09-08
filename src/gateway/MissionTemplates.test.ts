import { expect, it } from 'vitest';
import { FleetGateway } from './FleetGateway';
import { ManualScheduler } from './scheduler';
import { newPlan, newStep, validatePlan } from '../domain/planning';
import { instantiateTemplate } from '../domain/missionTemplates';
import type { Actor, Command } from '../domain/model';

async function setup() {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock);
  const actor: Actor = { id: 'planner', role: 'fleet-manager' };
  async function run(command: Command, identity = actor) {
    const ticket = gateway.command(identity, command);
    clock.advance(250);
    return ticket.promise;
  }
  const plan = {
    ...newPlan('P', 'FAC-001', 'R-001'),
    steps: [{ ...newStep('travel'), zoneId: 'Z-010' }],
  };
  await run({ type: 'plan.save', id: 'P', expectedRevision: 0, plan });
  const command = {
    type: 'template.create' as const,
    id: 'T',
    title: 'Dock arrival',
    sourcePlanId: 'P',
    sourceRevision: 1,
  };
  return { gateway, run, plan, command };
}
it('templates retain source revisions and instantiate independent, revalidated drafts', async () => {
  const { gateway, run, plan, command } = await setup();
  await run(command);
  const template = gateway.getSnapshot().missionTemplates.T;
  await run({
    type: 'plan.save',
    id: 'P',
    expectedRevision: 1,
    plan: {
      ...plan,
      title: 'Changed source',
      steps: [{ ...newStep('wait', 'wait'), seconds: 30 }],
    },
  });
  expect(template.sourceRevision).toBe(1);
  expect(template.plan.steps[0].kind).toBe('navigate');
  const draft = instantiateTemplate(template, 'NEW', 'R-001', 'other');
  expect(draft).toMatchObject({
    id: 'NEW',
    revision: 0,
    ownerId: 'other',
    templateSource: { id: 'T', revision: 1 },
  });
  expect(draft.steps).not.toBe(template.plan.steps);
  await run({ type: 'maintenance.start', id: 'SVC-R-001', expectedRevision: 1 });
  expect(validatePlan(gateway.getSnapshot(), draft).issues.map((issue) => issue.message)).toContain(
    'Robot under maintenance',
  );
  await expect(
    run({ type: 'plan.save', id: 'NEW', expectedRevision: 0, plan: draft }),
  ).rejects.toMatchObject({ code: 'invalid' });
  expect(gateway.getSnapshot().plans.NEW).toBeUndefined();
});
it('template creation enforces source revision, unique identity, title and facility permissions atomically', async () => {
  const { gateway, run, command } = await setup();
  const before = gateway.getSnapshot();
  for (const [input, actor, code] of [
    [{ ...command, sourceRevision: 0 }, { id: 'planner', role: 'fleet-manager' }, 'stale'],
    [{ ...command, title: ' ' }, { id: 'planner', role: 'fleet-manager' }, 'invalid'],
    [command, { id: 'viewer', role: 'viewer' }, 'forbidden'],
    [command, { id: 'limited', role: 'fleet-manager', facilityIds: ['FAC-002'] }, 'forbidden'],
  ] as [typeof command, Actor, string][]) {
    await expect(run(input, actor)).rejects.toMatchObject({ code });
    expect(gateway.getSnapshot()).toBe(before);
  }
  await run(command);
  const created = gateway.getSnapshot();
  await expect(run(command)).rejects.toMatchObject({ code: 'stale' });
  expect(gateway.getSnapshot()).toBe(created);
  expect(created.activity.at(-1)?.changes?.some((entry) => entry.kind === 'missionTemplates')).toBe(
    true,
  );
});
