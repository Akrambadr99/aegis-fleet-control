import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { FleetGateway } from '../../gateway/FleetGateway';
import { newPlan, newStep, type PlanValidation } from '../../domain/planning';
import type { Actor } from '../../domain/model';
import { useMissionValidation } from './useMissionValidation';

function setup() {
  const gateway = new FleetGateway();
  const requests: {
    resolve: (result: PlanValidation) => void;
    reject: (error: Error) => void;
    signal?: AbortSignal;
  }[] = [];
  vi.spyOn(gateway, 'validateMissionPlan').mockImplementation((_plan, signal) => {
    const promise = new Promise<PlanValidation>((resolve, reject) =>
      requests.push({ resolve, reject, signal }),
    );
    // Deliberately model a transport whose response can still arrive after cancellation.
    return {
      id: requests.length,
      status: 'pending',
      promise,
      cancel: () => {},
      supersede: () => {},
    };
  });
  const plan = { ...newPlan('P', 'FAC-001', 'R-001'), steps: [newStep('wait', 'wait')] };
  const actor: Actor = { id: 'planner', role: 'fleet-manager' };
  const props = { plan, actor, revision: 1 };
  const hook = renderHook(
    ({ plan, actor, revision }) => useMissionValidation(gateway, plan, revision, actor),
    { initialProps: props },
  );
  const result: PlanValidation = {
    issues: [],
    distance: 0,
    batteryRequired: 0,
    durationSeconds: 10,
    order: ['wait'],
    stateRevision: 1,
  };
  return { ...hook, requests, props, validation: result };
}

it.each([
  [0, 1],
  [1, 0],
])(
  'keeps the edited draft authoritative with completion order %s then %s',
  async (first, second) => {
    const { requests, props, result, rerender, validation } = setup();
    rerender({ ...props, plan: { ...props.plan, title: 'Changed draft' } });
    expect(requests[0].signal?.aborted).toBe(true);
    const completions = [
      { ...validation, issues: [{ stepId: null, message: 'Old result' }] },
      validation,
    ];
    await act(async () => requests[first].resolve(completions[first]));
    await act(async () => requests[second].resolve(completions[second]));
    expect(result.current).toMatchObject({ current: true, result: validation });
  },
);

it('invalidates pending robot assignment and permission results independently of plan revision', async () => {
  const { requests, props, result, rerender, validation } = setup();
  const reassigned = { ...props, plan: { ...props.plan, robotId: 'R-002' } };
  rerender(reassigned);
  rerender({ ...reassigned, actor: { ...props.actor, role: 'viewer' } });
  const denied = { ...validation, issues: [{ stepId: null, message: 'Permission changed' }] };
  await act(async () => requests[2].resolve(denied));
  await act(async () => {
    requests[1].resolve(validation);
    requests[0].resolve(validation);
  });
  expect(result.current.result).toEqual(denied);
  expect(requests.slice(0, 2).every((request) => request.signal?.aborted)).toBe(true);
});

it('ignores superseded errors, retries the current request and cancels on unmount', async () => {
  const { requests, result, validation, unmount } = setup();
  await act(async () => requests[0].reject(new Error('Temporarily unavailable')));
  expect(result.current.error).toBe('Temporarily unavailable');
  act(() => result.current.retry());
  expect(result.current.current).toBe(false);
  await act(async () => requests[1].resolve(validation));
  expect(result.current.result).toEqual(validation);
  unmount();
  expect(requests[1].signal?.aborted).toBe(true);
});

it('requires fresh validation after the operational state changes', async () => {
  const { requests, props, result, rerender, validation } = setup();
  await act(async () => requests[0].resolve(validation));
  rerender({ ...props, revision: 2 });
  expect(result.current.current).toBe(false);
  await act(async () => requests[1].resolve({ ...validation, stateRevision: 2 }));
  expect(result.current.result?.stateRevision).toBe(2);
});
