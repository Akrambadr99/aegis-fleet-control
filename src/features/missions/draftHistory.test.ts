import { expect, it } from 'vitest';
import { newPlan, newStep } from '../../domain/planning';
import { draftReducer, initialHistory, moveStep } from './draftHistory';
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
