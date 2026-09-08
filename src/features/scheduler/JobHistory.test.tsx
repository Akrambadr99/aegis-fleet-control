import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createSeed } from '../../domain/seed';
import { JobHistory } from './JobHistory';

it('shows past missions even when a partially completed job is unassigned', () => {
  const state = createSeed(),
    job = state.jobs['JOB-001'];
  job.status = 'partially-completed';
  job.missionId = null;
  job.missionIds = ['M-001', 'M-002'];
  render(<JobHistory job={job} state={state} />);
  expect(screen.getByText('M-001')).toBeVisible();
  expect(screen.getByText('M-002')).toBeVisible();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
});
