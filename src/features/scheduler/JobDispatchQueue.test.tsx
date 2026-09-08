import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { FleetProvider, useDomain } from '../../app/FleetProvider';
import { FleetGateway } from '../../gateway/FleetGateway';
import { ManualScheduler } from '../../gateway/scheduler';
import { createSeed } from '../../domain/seed';
import { JobDispatchQueue } from './JobDispatchQueue';

function setup() {
  const state = createSeed(),
    robot = state.robots['R-004'];
  robot.status = 'idle';
  robot.activeMissionId = null;
  robot.battery = 95;
  robot.position = { ...state.navigationNodes['F-001-OUT'].position };
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock, state),
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  function Queue() {
    const current = useDomain();
    return (
      <JobDispatchQueue
        facilityId="FAC-001"
        jobs={Object.values(current.jobs).filter((job) => job.facilityId === 'FAC-001')}
        selected="JOB-001"
        select={() => {}}
        tick={current.tick}
      />
    );
  }
  function Harness({ visible }: { visible: boolean }) {
    return (
      <QueryClientProvider client={client}>
        <FleetProvider gateway={gateway}>
          <MemoryRouter>{visible ? <Queue /> : <p>Another workspace</p>}</MemoryRouter>
        </FleetProvider>
      </QueryClientProvider>
    );
  }
  return { clock, gateway, client, Harness };
}
it('keeps captured batch outcomes separate from changing filters and selection', async () => {
  const { clock, gateway, client, Harness } = setup();
  render(<Harness visible />);
  fireEvent.click(screen.getByLabelText('Select JOB-001 for dispatch'));
  fireEvent.click(screen.getByLabelText('Select JOB-002 for dispatch'));
  fireEvent.click(screen.getByRole('button', { name: 'Dispatch selected jobs' }));
  await screen.findByText('Dispatching 2 jobs…');
  fireEvent.change(screen.getByLabelText('Search jobs'), { target: { value: 'JOB-002' } });
  fireEvent.click(screen.getByRole('button', { name: 'Clear dispatch selection' }));
  await act(async () => {
    clock.advance(250);
  });
  await screen.findByText('1 confirmed · 1 failed');
  expect(screen.getByText('0 jobs selected across queue filters')).toBeVisible();
  expect(screen.getByLabelText('Search jobs')).toHaveValue('JOB-002');
  expect(gateway.getSnapshot().jobs['JOB-001'].status).toBe('assigned');
  expect(screen.getByRole('button', { name: 'Retry failed jobs' })).toBeEnabled();
  client.clear();
});
it('retains pending ownership and completed results after leaving and returning', async () => {
  const { clock, client, Harness } = setup();
  const view = render(<Harness visible />);
  fireEvent.click(screen.getByLabelText('Select JOB-001 for dispatch'));
  fireEvent.click(screen.getByRole('button', { name: 'Dispatch selected jobs' }));
  await screen.findByText('Dispatching 1 jobs…');
  view.rerender(<Harness visible={false} />);
  view.rerender(<Harness visible />);
  expect(await screen.findByText('Dispatching 1 jobs…')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Dispatch selected jobs' })).toBeDisabled();
  view.rerender(<Harness visible={false} />);
  await act(async () => {
    clock.advance(250);
  });
  view.rerender(<Harness visible />);
  await waitFor(() => expect(screen.getByText('1 confirmed · 0 failed')).toBeVisible());
  client.clear();
});
