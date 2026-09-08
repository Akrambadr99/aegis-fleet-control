import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createSeed } from '../../domain/seed';
import { JobEditor } from './JobEditor';

it('retains unsaved input when lock metadata changes and saves against its updated revision', () => {
  const state = createSeed(),
    job = state.jobs['JOB-001'],
    onSave = vi.fn();
  const view = render(
    <JobEditor
      state={state}
      facilityId={job.facilityId}
      job={job}
      pending={false}
      onSave={onSave}
    />,
  );
  fireEvent.change(screen.getByLabelText('Job title'), {
    target: { value: 'Local dispatch notes' },
  });
  view.rerender(
    <JobEditor
      state={state}
      facilityId={job.facilityId}
      job={{
        ...job,
        revision: 2,
        dispatchLock: {
          ownerId: 'operator',
          acquiredAt: 0,
          expiresAt: 120,
          state: 'active',
          reason: 'Planning',
        },
      }}
      pending={false}
      onSave={onSave}
    />,
  );
  expect(screen.getByLabelText('Job title')).toHaveValue('Local dispatch notes');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save job requirements' }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Local dispatch notes' }),
    2,
  );
});
it('rebases only edited fields while preserving a concurrent priority change', () => {
  const state = createSeed(),
    job = state.jobs['JOB-001'],
    onSave = vi.fn();
  const view = render(
    <JobEditor
      state={state}
      facilityId={job.facilityId}
      job={job}
      pending={false}
      onSave={onSave}
    />,
  );
  fireEvent.change(screen.getByLabelText('Job title'), {
    target: { value: 'Locally revised title' },
  });
  view.rerender(
    <JobEditor
      state={state}
      facilityId={job.facilityId}
      job={{ ...job, revision: 2, priority: 5 }}
      pending={false}
      onSave={onSave}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Priority');
  expect(screen.getByRole('alert')).toHaveTextContent('Current: 5');
  expect(screen.getByRole('button', { name: 'Save job requirements' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Apply my edited fields' }));
  expect(screen.getByRole('combobox', { name: 'Job priority' })).toHaveValue('5');
  fireEvent.click(screen.getByRole('button', { name: 'Save job requirements' }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Locally revised title', priority: 5 }),
    2,
  );
});
it('shows both versions of competing edits and discards local changes only on explicit reload', () => {
  const state = createSeed(),
    job = state.jobs['JOB-001'];
  const view = render(
    <JobEditor
      state={state}
      facilityId={job.facilityId}
      job={job}
      pending={false}
      onSave={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'My title' } });
  view.rerender(
    <JobEditor
      state={state}
      facilityId={job.facilityId}
      job={{ ...job, revision: 2, title: 'Other dispatcher title' }}
      pending={false}
      onSave={() => {}}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Current: Other dispatcher title · Your draft: My title',
  );
  expect(screen.getByLabelText('Job title')).toHaveValue('My title');
  fireEvent.click(screen.getByRole('button', { name: 'Reload current requirements' }));
  expect(screen.getByLabelText('Job title')).toHaveValue('Other dispatcher title');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('a clean editor follows incoming requirements without presenting an unnecessary conflict', () => {
  const state = createSeed(),
    job = state.jobs['JOB-001'];
  const view = render(
    <JobEditor
      state={state}
      facilityId={job.facilityId}
      job={job}
      pending={false}
      onSave={() => {}}
    />,
  );
  view.rerender(
    <JobEditor
      state={state}
      facilityId={job.facilityId}
      job={{ ...job, revision: 2, title: 'Current title' }}
      pending={false}
      onSave={() => {}}
    />,
  );
  expect(screen.getByLabelText('Job title')).toHaveValue('Current title');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
