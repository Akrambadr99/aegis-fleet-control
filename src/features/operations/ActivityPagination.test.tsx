import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { expect, it } from 'vitest';
import { FleetProvider } from '../../app/FleetProvider';
import { FleetGateway } from '../../gateway/FleetGateway';
import { createSeed } from '../../domain/seed';
import { ActivityPanel } from './ResourcePanels';
function Location() {
  return <output>{useLocation().search}</output>;
}
it('pages older activity without dropping the selected robot or rendering the whole stream', async () => {
  const state = createSeed();
  state.activity = Array.from({ length: 100 }, (_, i) => ({
    id: 'event' + i,
    tick: i,
    actorId: 'a',
    type: 'robot.connected',
    entityId: 'R-001',
    details: 'Entry ' + i,
  }));
  render(
    <FleetProvider gateway={new FleetGateway(undefined, state)}>
      <MemoryRouter initialEntries={['/activity?robot=R-001']}>
        <ActivityPanel />
        <Location />
      </MemoryRouter>
    </FleetProvider>,
  );
  expect(screen.getByText('Entry 99')).toBeVisible();
  expect(screen.queryByText('Entry 0')).toBeNull();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Next Activity' }));
  expect(screen.getByText('Entry 0')).toBeVisible();
  expect(screen.queryByText('Entry 99')).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent('robot=R-001&activityPage=1');
});
