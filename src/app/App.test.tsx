import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderApp';
describe('application foundation', () => {
  it('opens the overview with explicitly simulated context', () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Every robot');
    expect(screen.getByText('SIMULATED ENVIRONMENT')).toBeVisible();
    expect(screen.getByText(/No physical robots connected/)).toBeVisible();
  });
  it('marks exactly one navigation link as current', () => {
    renderApp('/traffic');
    const links = within(screen.getByRole('navigation')).getAllByRole('link');
    expect(links.filter((link) => link.getAttribute('aria-current') === 'page')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Traffic' })).toHaveAttribute('aria-current', 'page');
  });
  it('moves focus to the workspace after route navigation', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('link', { name: 'Robot fleet' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Robot fleet');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(document.title).toBe('Robot fleet | Aegis Fleet Control');
  });
  it('recovers from an unknown deep link', async () => {
    const user = userEvent.setup();
    renderApp('/does-not-exist');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Workspace not found');
    await user.click(screen.getByRole('link', { name: 'Return to operations overview' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Every robot');
  });
  it('does not imply planned operational controls work', () => {
    renderApp('/permissions');
    expect(screen.getByRole('heading', { name: 'Workspace planned' })).toBeVisible();
    expect(screen.getByText('Planned · M20')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Acquire control' })).not.toBeInTheDocument();
  });
  it('reads a facility from a shared URL', () => {
    renderApp('/?facility=meridian');
    expect(screen.getByRole('combobox', { name: 'Facility' })).toHaveValue('meridian');
    expect(screen.getByRole('heading', { name: 'Meridian Assembly' })).toBeVisible();
    expect(screen.getByRole('img')).toHaveAccessibleName(/Meridian Assembly/);
  });
  it('switches metrics, map and advisories together', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.selectOptions(screen.getByRole('combobox'), 'meridian');
    expect(screen.getByText('FAC-002 · Local operating facility')).toBeVisible();
    expect(screen.getByText('R-039: Localization confidence below threshold')).toBeVisible();
    expect(
      screen.queryByText('R-009: Localization confidence below threshold'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '80');
  });
  it('keeps selector focus during query-only updates', async () => {
    const user = userEvent.setup();
    renderApp();
    const selector = screen.getByRole('combobox');
    await user.selectOptions(selector, 'meridian');
    expect(selector).toHaveFocus();
  });
  it('falls back safely for an unknown facility', () => {
    renderApp('/?facility=missing');
    expect(screen.getByRole('combobox')).toHaveValue('northstar');
    expect(screen.getByRole('heading', { name: 'Northstar Logistics' })).toBeVisible();
  });
  it('provides a semantic skip destination', () => {
    renderApp();
    expect(screen.getByRole('link', { name: 'Skip to workspace' })).toHaveAttribute(
      'href',
      '#workspace-content',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'workspace-content');
  });
  it('keeps domain routes individually addressable', () => {
    renderApp('/missions');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mission editor');
    expect(document.title).toContain('Mission management');
  });
});
