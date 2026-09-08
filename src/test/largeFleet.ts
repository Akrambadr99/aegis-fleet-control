import type { DomainState } from '../domain/model';
import { createSeed } from '../domain/seed';
import { assertInvariants } from '../domain/invariants';
/** Scale real fixtures while preserving every ID relationship and historical snapshot. */
export function createLargeFleet(copies = 5, jobs = 1000): DomainState {
  const seed = createSeed();
  const identities = new Set<string>();
  function collect(value: unknown) {
    if (!value || typeof value !== 'object') return;
    if ('id' in value && typeof value.id === 'string') identities.add(value.id);
    for (const child of Object.values(value)) collect(child);
  }
  collect(seed);
  const result = structuredClone(seed) as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(result)) {
    if (Array.isArray(value)) result[key] = [];
    else if (value && typeof value === 'object') result[key] = {};
  }
  for (let index = 0; index < copies; index++) {
    const rename = (value: string) =>
      identities.has(value) ? 'SCALE' + index + '-' + value : value;
    function copy(value: unknown): unknown {
      if (typeof value === 'string') return rename(value);
      if (Array.isArray(value)) return value.map(copy);
      if (value && typeof value === 'object')
        return Object.fromEntries(
          Object.entries(value).map(([key, child]) => [rename(key), copy(child)]),
        );
      return value;
    }
    const next = copy(seed) as Record<string, unknown>;
    for (const [key, value] of Object.entries(next)) {
      if (Array.isArray(value)) (result[key] as unknown[]).push(...value);
      else if (value && typeof value === 'object') Object.assign(result[key] as object, value);
    }
  }
  const state = result as unknown as DomainState;
  state.history.forEach((frame, index) => (frame.sequence = index + 1));
  state.historySequence = state.history.length;
  const template = Object.values(state.jobs)[0];
  for (let index = Object.keys(state.jobs).length; index < jobs; index++) {
    const id = 'LOADJOB-' + index;
    state.jobs[id] = {
      ...structuredClone(template),
      id,
      title: 'Scale job ' + index,
      dependsOn: [],
      status: 'queued',
      completedUnits: 0,
      assignedUnits: 0,
      robotId: null,
      missionId: null,
      missionIds: [],
      custody: 'source',
    };
  }
  assertInvariants(state);
  return state;
}
