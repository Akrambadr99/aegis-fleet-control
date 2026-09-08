import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { FleetProvider } from '../../app/FleetProvider';
import { FleetGateway } from '../../gateway/FleetGateway';
import { ManualScheduler } from '../../gateway/scheduler';
import { MissionDraftProvider } from './MissionDraftProvider';
import { MissionPlanning } from './MissionPlanning';
it('late validation cannot replace the current edited draft result', async () => {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock);
  gateway.requests.plan({ delay: 1000 }, { delay: 10 });
  render(
    <FleetProvider gateway={gateway}>
      <MissionDraftProvider>
        <MissionPlanning />
      </MissionDraftProvider>
    </FleetProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
  await act(async () => clock.advance(10));
  expect(screen.getByRole('button', { name: 'Save mission' })).toBeEnabled();
  await act(async () => clock.advance(1000));
  expect(screen.getByRole('button', { name: 'Save mission' })).toBeEnabled();
  expect(screen.queryByText('Add at least one mission step')).not.toBeInTheDocument();
});
