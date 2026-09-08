import { fireEvent, render, screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { AppProviders, createQueryClient } from './AppProviders';
import { useDomain, useFleet } from './FleetProvider';
it('isolates server data between application instances', () => {
  const first = createQueryClient();
  const second = createQueryClient();
  first.setQueryData(['robot', 'r1'], { battery: 45 });
  expect(second.getQueryData(['robot', 'r1'])).toBeUndefined();
  first.clear();
  second.clear();
});
it('retains the query cache when its provider rerenders', () => {
  function Probe({ write }: { write: boolean }) {
    const client = useQueryClient();
    if (write) client.setQueryData(['probe'], 'cached');
    return <p>{client.getQueryData<string>(['probe'])}</p>;
  }
  const view = render(
    <AppProviders>
      <Probe write />
    </AppProviders>,
  );
  view.rerender(
    <AppProviders>
      <Probe write={false} />
    </AppProviders>,
  );
  expect(screen.getByText('cached')).toBeVisible();
});

it('restores committed fleet state when the application remounts', () => {
  function Probe() {
    const state = useDomain();
    const { gateway } = useFleet();
    return <button onClick={() => gateway.advance()}>Tick {state.tick}</button>;
  }

  const first = render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Tick 0' }));
  expect(screen.getByRole('button', { name: 'Tick 1' })).toBeVisible();
  first.unmount();

  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  );
  expect(screen.getByRole('button', { name: 'Tick 1' })).toBeVisible();
});
