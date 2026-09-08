import { act, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { createQueryClient } from '../../app/AppProviders';
import { FleetProvider } from '../../app/FleetProvider';
import { FleetGateway } from '../../gateway/FleetGateway';
import { ManualScheduler } from '../../gateway/scheduler';
import { DiagnosticsWorkspace } from './DiagnosticsWorkspace';

it('observes committed event batches and isolated worker failures', async () => {
  const clock = new ManualScheduler();
  const gateway = new FleetGateway(clock);
  gateway.workers.register({
    id: 'offline-export',
    retryDelays: [],
    handle() {
      throw new Error('export worker unavailable');
    },
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <FleetProvider gateway={gateway}>
        <DiagnosticsWorkspace />
      </FleetProvider>
    </QueryClientProvider>,
  );
  gateway.events.subscribe(() => {
    throw new Error('index worker unavailable');
  });
  expect(screen.getByText('Committed batches 0 · Events 0 · Delivery failures 0')).toBeVisible();

  const ticket = gateway.command(
    { id: 'operator', role: 'administrator' },
    { type: 'robot.stop', id: 'R-001', expectedRevision: 1 },
  );
  act(() => clock.advance(250));
  await ticket.promise;
  await Promise.resolve();

  expect(screen.getByText('Committed batches 1 · Events 1 · Delivery failures 1')).toBeVisible();
  expect(screen.getByRole('list', { name: 'Event delivery failures' })).toHaveTextContent(
    'index worker unavailable',
  );
  expect(screen.getByRole('list', { name: 'Background workers' })).toHaveTextContent(
    'offline-export · failed · pending 1 · last revision none · export worker unavailable',
  );
});
