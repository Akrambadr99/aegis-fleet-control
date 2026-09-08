import { expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../../test/renderApp';
it('inserts and duplicates selected steps and restores them through undo and redo', async () => {
  const user = userEvent.setup();
  renderApp('/missions');
  await user.click(screen.getByRole('button', { name: 'Add step' }));
  await user.type(screen.getByLabelText('Step label'), 'Approach dock');
  await user.click(screen.getByRole('button', { name: 'Duplicate S-1' }));
  expect(screen.getByLabelText('Step label')).toHaveValue('Approach dock copy');
  await user.click(screen.getByRole('button', { name: 'Insert before S-1' }));
  expect(screen.getByLabelText('Step label')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Remove S-3' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  expect(screen.queryByRole('button', { name: 'Remove S-3' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Redo' }));
  expect(screen.getByRole('button', { name: 'Remove S-3' })).toBeVisible();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save mission' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Save mission' }));
  expect(await screen.findByText('Mission plan saved')).toBeVisible();
});
it('edits, validates and saves a mission plan, then cancels a local change', async () => {
  const user = userEvent.setup();
  renderApp('/missions');
  await user.click(screen.getByRole('button', { name: 'Add step' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save mission' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Save mission' }));
  expect(await screen.findByText('Mission plan saved')).toBeVisible();
  await user.clear(screen.getByLabelText('Mission title'));
  await user.type(screen.getByLabelText('Mission title'), 'Changed');
  await user.click(screen.getByRole('button', { name: 'Cancel draft' }));
  await user.click(screen.getByRole('button', { name: 'Discard changes' }));
  expect(screen.getByLabelText('Mission title')).toHaveValue('Dock transfer');
});
it('undo removes the entire step addition and redo restores it', async () => {
  const user = userEvent.setup();
  renderApp('/missions');
  await user.click(screen.getByRole('button', { name: 'Add step' }));
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  expect(screen.getByText('Add the first step to define this mission.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Redo' }));
  expect(screen.getByRole('button', { name: 'Remove S-1' })).toBeVisible();
});

it('retains unsaved steps and undo history while inspecting another workspace', async () => {
  const user = userEvent.setup();
  renderApp('/missions');
  await user.click(screen.getByRole('button', { name: 'Add step' }));
  await user.click(screen.getByRole('link', { name: 'Traffic' }));
  await user.click(screen.getByRole('link', { name: 'Missions' }));
  expect(screen.getByRole('button', { name: 'Remove S-1' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
});
