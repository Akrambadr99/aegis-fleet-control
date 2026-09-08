import { expect, it } from 'vitest';
import { newPlan, newStep } from '../../domain/planning';
import { draftReducer, initialHistory, insertStep, moveStep } from './draftHistory';
it('undo and redo retain whole drafts and invalidate redo after a new branch', () => {
  const plan = newPlan('P', 'FAC-001', 'R-001');
  let state = initialHistory(plan);
  state = draftReducer(state, {
    type: 'edit',
    plan: { ...plan, title: 'Changed', steps: [newStep('a')] },
  });
  state = draftReducer(state, { type: 'undo' });
  expect(state.present).toEqual(plan);
  state = draftReducer(state, { type: 'redo' });
  expect(state.present.steps).toHaveLength(1);
  state = draftReducer(state, { type: 'undo' });
  state = draftReducer(state, { type: 'edit', plan: { ...plan, title: 'Branch' } });
  expect(state.future).toEqual([]);
  expect(state.baseline).toEqual(plan);
});

it('inserts at a chosen position without rewiring existing dependencies', () => {
  const plan = {
    ...newPlan('P', 'FAC-001', 'R-001'),
    steps: [newStep('S-1'), { ...newStep('S-3'), dependsOn: ['S-1'] }],
  };
  const next = insertStep(plan, 1);
  expect(next.steps.map((step) => step.id)).toEqual(['S-1', 'S-2', 'S-3']);
  expect(next.steps[1].dependsOn).toEqual(['S-1']);
  expect(next.steps[2].dependsOn).toEqual(['S-1']);
  expect(plan.steps).toHaveLength(2);
  expect(insertStep(plan, -1)).toBe(plan);
  expect(insertStep(plan, 3)).toBe(plan);
});

it('duplicates constraints with independent identity and reversible history', () => {
  const plan = {
    ...newPlan('P', 'FAC-001', 'R-001'),
    steps: [
      newStep('S-1'),
      {
        ...newStep('S-2', 'pickup'),
        payloadKg: 70,
        dependsOn: ['S-1'],
        condition: 'battery-low' as const,
      },
    ],
  };
  const next = insertStep(plan, 2, 'S-2');
  expect(next.steps[2]).toEqual({ ...plan.steps[1], id: 'S-3', label: 'S-2 copy' });
  expect(next.steps[2].dependsOn).not.toBe(plan.steps[1].dependsOn);
  let history = draftReducer(initialHistory(plan), { type: 'edit', plan: next });
  history = draftReducer(history, { type: 'undo' });
  expect(history.present).toEqual(plan);
  expect(draftReducer(history, { type: 'redo' }).present).toEqual(next);
  expect(insertStep(plan, 0, 'missing')).toBe(plan);
});
it('reordering preserves stable dependency ids and leaves the input immutable', () => {
  const plan = {
    ...newPlan('P', 'FAC-001', 'R-001'),
    steps: [newStep('a'), { ...newStep('b'), dependsOn: ['a'] }],
  };
  const moved = moveStep(plan, 'b', 0);
  expect(moved.steps.map((s) => s.id)).toEqual(['b', 'a']);
  expect(moved.steps[0].dependsOn).toEqual(['a']);
  expect(plan.steps[0].id).toBe('a');
});
it('reset establishes a clean baseline and clears both history directions', () => {
  let state = initialHistory(newPlan('P', 'FAC-001', 'R-001'));
  state = draftReducer(state, { type: 'edit', plan: { ...state.present, title: 'Edited' } });
  const saved = { ...state.present, revision: 2 };
  state = draftReducer(state, { type: 'reset', plan: saved });
  expect(state.past).toEqual([]);
  expect(state.future).toEqual([]);
  expect(state.baseline).toEqual(saved);
});
