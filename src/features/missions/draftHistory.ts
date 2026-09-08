import { newStep, type MissionPlan } from '../../domain/planning';
export type PlanFieldChange = {
  [K in keyof MissionPlan]-?: { field: K; before: MissionPlan[K]; after: MissionPlan[K] };
}[keyof MissionPlan];
export type UndoablePlanCommand =
  | { type: 'update-fields'; changes: PlanFieldChange[] }
  | { type: 'move-step'; id: string; from: number; to: number };
export interface DraftHistory {
  present: MissionPlan;
  baseline: MissionPlan;
  past: UndoablePlanCommand[];
  future: UndoablePlanCommand[];
}
export type DraftAction =
  | { type: 'reset'; plan: MissionPlan }
  | { type: 'edit'; plan: MissionPlan }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'move-step'; id: string; target: number };
export function initialHistory(plan: MissionPlan): DraftHistory {
  return { present: structuredClone(plan), baseline: structuredClone(plan), past: [], future: [] };
}
function applyEdit(plan: MissionPlan, command: UndoablePlanCommand, reverse = false): MissionPlan {
  if (command.type === 'move-step')
    return moveStep(plan, command.id, reverse ? command.from : command.to);
  const next = structuredClone(plan);
  for (const change of command.changes)
    Object.assign(next, {
      [change.field]: structuredClone(reverse ? change.before : change.after),
    });
  return next;
}
/** Undo remains local to a draft. Save/reset establishes a new baseline and clears history. */
export function draftReducer(state: DraftHistory, action: DraftAction): DraftHistory {
  if (action.type === 'reset') return initialHistory(action.plan);
  if (action.type === 'undo' || action.type === 'redo') {
    const reverse = action.type === 'undo';
    const command = reverse ? state.past.at(-1) : state.future[0];
    if (!command) return state;
    return {
      ...state,
      present: applyEdit(state.present, command, reverse),
      past: reverse ? state.past.slice(0, -1) : [...state.past, command],
      future: reverse ? [command, ...state.future] : state.future.slice(1),
    };
  }
  let command: UndoablePlanCommand;
  if (action.type === 'move-step') {
    const from = state.present.steps.findIndex((step) => step.id === action.id);
    if (
      from < 0 ||
      action.target < 0 ||
      action.target >= state.present.steps.length ||
      from === action.target
    )
      return state;
    command = { type: 'move-step', id: action.id, from, to: action.target };
  } else {
    const fields = [
      ...new Set([...Object.keys(state.present), ...Object.keys(action.plan)]),
    ] as (keyof MissionPlan)[];
    const changes = fields
      .filter(
        (field) => JSON.stringify(state.present[field]) !== JSON.stringify(action.plan[field]),
      )
      .map(
        (field) =>
          ({
            field,
            before: structuredClone(state.present[field]),
            after: structuredClone(action.plan[field]),
          }) as PlanFieldChange,
      );
    if (!changes.length) return state;
    command = { type: 'update-fields', changes };
  }
  return {
    ...state,
    present: applyEdit(state.present, command),
    past: [...state.past.slice(-49), command],
    future: [],
  };
}
export function moveStep(plan: MissionPlan, id: string, target: number): MissionPlan {
  const next = structuredClone(plan),
    from = next.steps.findIndex((s) => s.id === id);
  if (from < 0 || target < 0 || target >= next.steps.length || from === target) return plan;
  next.steps.splice(target, 0, next.steps.splice(from, 1)[0]);
  return next;
}

/** Insert without silently changing the dependency graph of existing steps. */
export function insertStep(plan: MissionPlan, index: number, sourceId?: string): MissionPlan {
  if (!Number.isInteger(index) || index < 0 || index > plan.steps.length) return plan;
  const source = sourceId ? plan.steps.find((step) => step.id === sourceId) : undefined;
  if (sourceId && !source) return plan;
  let number = 1;
  while (plan.steps.some((step) => step.id === 'S-' + number)) number++;
  const id = 'S-' + number;
  const step = source
    ? { ...structuredClone(source), id, label: (source.label || source.id) + ' copy' }
    : { ...newStep(id), dependsOn: index ? [plan.steps[index - 1].id] : [] };
  return { ...plan, steps: [...plan.steps.slice(0, index), step, ...plan.steps.slice(index)] };
}
