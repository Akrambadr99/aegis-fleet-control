import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { createSeed } from '../../domain/seed';
import { JobQueuePanel } from './JobQueuePanel';
import { JobDependencies } from './JobDependencies';

it('filters the queue without discarding the selected inspector or dependency navigation', () => {
  const jobs = Object.values(createSeed().jobs).filter((job) => job.facilityId === 'FAC-001');
  const select = vi.fn();
  render(
    <MemoryRouter>
      <JobQueuePanel jobs={jobs} selected="JOB-001" select={select} tick={0} />
      <JobDependencies job={jobs[0]} jobs={jobs} select={select} />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText('Search jobs'), { target: { value: 'JOB-002' } });
  expect(screen.getByText('1 of 2 jobs shown')).toBeVisible();
  expect(screen.getByText(/Selected job JOB-001 is outside/)).toBeVisible();
  fireEvent.click(
    within(screen.getByRole('region', { name: 'Job dependency graph' })).getByRole('button', {
      name: 'JOB-002',
    }),
  );
  expect(select).toHaveBeenCalledWith('JOB-002');
  fireEvent.change(screen.getByLabelText('Minimum job priority'), { target: { value: '5' } });
  expect(screen.getByText('0 of 2 jobs shown')).toBeVisible();
});
