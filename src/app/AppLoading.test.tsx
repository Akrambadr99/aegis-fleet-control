import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { renderApp } from '../test/renderApp';
const deferred = vi.hoisted(() => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { ready, release };
});
vi.mock('../features/replay/ReplayWorkspace', async () => {
  await deferred.ready;
  return { ReplayWorkspace: () => <h1>Loaded replay</h1> };
});
it('keeps shell navigation usable during workspace loading and ignores departed content', async () => {
  const user = userEvent.setup();
  renderApp('/replay');
  expect(screen.getByRole('status')).toHaveTextContent('Loading workspace');
  await user.click(screen.getByRole('link', { name: 'Overview' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Every robot');
  await act(async () => deferred.release());
  expect(screen.queryByText('Loaded replay')).not.toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Replay' }));
  expect(await screen.findByRole('heading', { name: 'Loaded replay' })).toBeVisible();
});
