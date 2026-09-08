import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createSeed } from '../../domain/seed';
import { newPlan, newStep } from '../../domain/planning';
import { StepInspector } from './StepInspector';

it.each([
  ['dock', 'dock'],
  ['open-door', 'door'],
  ['call-elevator', 'elevator'],
] as const)('offers only %s resources in the selected facility', (kind, resourceKind) => {
  const state = createSeed(),
    plan = newPlan('P', 'FAC-001', 'R-001');
  const step = newStep('use', kind),
    update = vi.fn();
  render(<StepInspector plan={plan} step={step} state={state} update={update} />);
  const options = within(screen.getByLabelText('Resource identifier'))
    .getAllByRole('option')
    .slice(1);
  expect(options.length).toBeGreaterThan(0);
  for (const option of options) {
    const resource = state.resources[(option as HTMLOptionElement).value];
    expect(resource).toMatchObject({ kind: resourceKind, facilityId: 'FAC-001' });
  }
  const id = (options[0] as HTMLOptionElement).value;
  fireEvent.change(screen.getByLabelText('Resource identifier'), { target: { value: id } });
  expect(update).toHaveBeenCalledWith({ ...step, resourceId: id });
  expect(screen.getByLabelText('Duration seconds')).toBeVisible();
});
