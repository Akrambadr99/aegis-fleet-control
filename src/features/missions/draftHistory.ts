import type { MissionPlan } from '../../domain/planning';
export interface DraftHistory {
  present: MissionPlan;
  baseline: MissionPlan;
  past: MissionPlan[];
  future: MissionPlan[];
}
export type DraftAction = { type: 'reset' | 'edit'; plan: MissionPlan } | { type: 'undo' | 'redo' };
export function initialHistory(plan: MissionPlan): DraftHistory {
  return { present: structuredClone(plan), baseline: structuredClone(plan), past: [], future: [] };
}
export function draftReducer(state: DraftHistory, action: DraftAction): DraftHistory {
  if (action.type === 'reset') return initialHistory(action.plan);
  if (action.type === 'edit') {
    if (JSON.stringify(action.plan) === JSON.stringify(state.present)) return state;
    return {
      ...state,
      past: [...state.past.slice(-49), state.present],
      present: structuredClone(action.plan),
      future: [],
    };
  }
  if (action.type === 'undo' && state.past.length)
    return {
      ...state,
      present: state.past.at(-1)!,
      past: state.past.slice(0, -1),
      future: [state.present, ...state.future],
    };
  if (action.type === 'redo' && state.future.length)
    return {
      ...state,
      past: [...state.past, state.present],
      present: state.future[0],
      future: state.future.slice(1),
    };
  return state;
}
export function moveStep(plan: MissionPlan, id: string, target: number): MissionPlan {
  const next = structuredClone(plan),
    from = next.steps.findIndex((s) => s.id === id);
  if (from < 0 || target < 0 || target >= next.steps.length || from === target) return plan;
  next.steps.splice(target, 0, next.steps.splice(from, 1)[0]);
  return next;
}
