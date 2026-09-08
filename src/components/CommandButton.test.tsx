import { act, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { FleetProvider } from '../app/FleetProvider';
import { FleetGateway } from '../gateway/FleetGateway';
import { ManualScheduler } from '../gateway/scheduler';
import { CommandButton } from './CommandButton';
it('retains entity/action pending state across remount without disabling unrelated commands', async () => {
  const clock = new ManualScheduler();
  const gateway = new FleetGateway(clock);
  const command = { type: 'robot.stop' as const, id: 'R-001', expectedRevision: 1 };
  const ticket = gateway.command({ id: 'operator', role: 'administrator' }, command);
  const view = render(
    <FleetProvider gateway={gateway}>
      <CommandButton command={command}>Stop</CommandButton>
      <CommandButton command={{ ...command, id: 'R-002' }}>Other</CommandButton>
    </FleetProvider>,
  );
  expect(screen.getByText('Applying…')).toBeDisabled();
  expect(screen.getByText('Other')).toBeEnabled();
  view.unmount();
  render(
    <FleetProvider gateway={gateway}>
      <CommandButton command={command}>Stop</CommandButton>
    </FleetProvider>,
  );
  expect(screen.getByText('Applying…')).toBeDisabled();
  await act(async () => {
    clock.advance(250);
    await ticket.promise;
  });
  expect(screen.getByText('Stop')).toBeEnabled();
});
