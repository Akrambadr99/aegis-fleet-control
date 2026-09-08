import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { FleetProvider } from '../../app/FleetProvider';
import { FleetGateway } from '../../gateway/FleetGateway';
import { ManualScheduler } from '../../gateway/scheduler';
import { MissionDraftProvider } from './MissionDraftProvider';
import { MissionPlanning } from './MissionPlanning';

function Navigation() {
  const [visible, setVisible] = useState(true);
  return (
    <>
      <button onClick={() => setVisible((value) => !value)}>Toggle workspace</button>
      {visible && <MissionPlanning />}
    </>
  );
}
it('retains pending save ownership and its result across editor remounts', async () => {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock);
  render(
    <FleetProvider gateway={gateway}>
      <MissionDraftProvider>
        <Navigation />
      </MissionDraftProvider>
    </FleetProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
  await act(async () => clock.advance(250));
  gateway.requests.plan({ delay: 1000 });
  fireEvent.click(screen.getByRole('button', { name: 'Save mission' }));
  fireEvent.click(screen.getByRole('button', { name: 'Toggle workspace' }));
  fireEvent.click(screen.getByRole('button', { name: 'Toggle workspace' }));
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'New mission' })).toBeDisabled();
  await act(async () => clock.advance(1000));
  expect(screen.getByText('Mission plan saved')).toBeVisible();
  expect(Object.values(gateway.getSnapshot().plans)).toHaveLength(1);
  expect(screen.getByLabelText('Mission title')).toHaveValue('Dock transfer');
});
it('keeps the failed draft and permits retry after returning to the editor', async () => {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock);
  render(
    <FleetProvider gateway={gateway}>
      <MissionDraftProvider>
        <Navigation />
      </MissionDraftProvider>
    </FleetProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
  await act(async () => clock.advance(250));
  gateway.requests.plan({ delay: 1000, failure: 'Save unavailable' });
  fireEvent.click(screen.getByRole('button', { name: 'Save mission' }));
  fireEvent.click(screen.getByRole('button', { name: 'Toggle workspace' }));
  await act(async () => clock.advance(1000));
  fireEvent.click(screen.getByRole('button', { name: 'Toggle workspace' }));
  await act(async () => clock.advance(250));
  expect(screen.getByText('Save unavailable')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Remove S-1' })).toBeVisible();
  expect(gateway.getSnapshot().plans).toEqual({});
  fireEvent.click(screen.getByRole('button', { name: 'Save mission' }));
  await act(async () => clock.advance(250));
  expect(screen.getByText('Mission plan saved')).toBeVisible();
  expect(Object.values(gateway.getSnapshot().plans)).toHaveLength(1);
});
