import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { App } from '../../app/App';
import { createQueryClient } from '../../app/AppProviders';
import { FleetProvider } from '../../app/FleetProvider';
import { FleetGateway } from '../../gateway/FleetGateway';
import { ManualScheduler } from '../../gateway/scheduler';
function setup(path: string) {
  const clock = new ManualScheduler(),
    gateway = new FleetGateway(clock);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <FleetProvider gateway={gateway}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </FleetProvider>
    </QueryClientProvider>,
  );
  return { clock, gateway, user: userEvent.setup() };
}
async function settle(clock: ManualScheduler, delay = 250) {
  await act(async () => {
    clock.advance(delay);
    await Promise.resolve();
  });
}
describe('connected React operations', () => {
  it('closing a corridor updates the visible inspector and scenario inputs', async () => {
    const { clock, user } = setup('/traffic?robot=R-001');
    await user.click(screen.getByRole('button', { name: 'Close C-001' }));
    await settle(clock);
    const inspector = screen.getByRole('complementary', { name: 'Robot inspector' });
    expect(within(inspector).getByText(/paused · Corridor closed/)).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Simulation' }));
    expect(screen.getByText('C-001')).toBeVisible();
  });
  it('charger outage updates a robot warning while its inspector remains open', async () => {
    const { clock, user } = setup('/charging?robot=R-001');
    await user.click(screen.getByRole('button', { name: 'Disable CHG-001' }));
    await settle(clock);
    expect(
      within(screen.getByRole('complementary', { name: 'Robot inspector' })).getAllByText(
        /Charging reservation displaced/,
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/displaced/).length).toBeGreaterThan(1);
  });
  it('emergency stop is observed by mission execution and replay', async () => {
    const { clock, user } = setup('/fleet?robot=R-001');
    await user.click(screen.getByRole('button', { name: 'Emergency stop R-001' }));
    await settle(clock);
    const inspector = screen.getByRole('complementary', { name: 'Robot inspector' });
    expect(within(inspector).getByText(/emergency-stopped · Battery/)).toBeVisible();
    await user.click(within(inspector).getByRole('link', { name: 'replay' }));
    expect(screen.getByText(/Mission paused · Reservation released/)).toBeVisible();
  });
  it('changing selection while bulk pause is pending preserves the current selection', async () => {
    const { clock, user } = setup('/fleet');
    await user.click(screen.getByRole('checkbox', { name: 'Select R-001' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select R-010' }));
    await user.click(screen.getByRole('button', { name: 'Pause selected' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select R-001' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select R-002' }));
    await settle(clock);
    expect(screen.getByRole('checkbox', { name: 'Select R-002' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select R-001' })).not.toBeChecked();
    expect(screen.getByText(/R-001: confirmed/)).toBeVisible();
    expect(screen.getByText(/R-010: failed/)).toBeVisible();
  });
  it('a role change disables protected controls but keeps navigation and filters usable', async () => {
    const { user } = setup('/traffic');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Simulation role' }), 'viewer');
    expect(screen.getByRole('button', { name: 'Close C-001' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Floor' })).toBeEnabled();
  });
  it('failed commands leave confirmed topology unchanged and can be retried', async () => {
    const { clock, gateway, user } = setup('/traffic');
    gateway.requests.plan({ failure: 'Deterministic failure' });
    await user.click(screen.getByRole('button', { name: 'Close C-001' }));
    await settle(clock);
    expect(screen.getByRole('alert')).toHaveTextContent('Deterministic failure');
    expect(screen.getByRole('button', { name: 'Close C-001' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Close C-001' }));
    await settle(clock);
    expect(screen.getByRole('button', { name: 'Open C-001' })).toBeVisible();
  });
  it('an in-flight floor mutation completes after navigating to another workspace', async () => {
    const { clock, user } = setup('/traffic');
    await user.click(screen.getByRole('button', { name: 'Close C-001' }));
    await user.click(screen.getByRole('link', { name: 'Digital twin' }));
    await settle(clock);
    expect(screen.getByRole('button', { name: 'Open C-001' })).toBeVisible();
  });
  it('independent commands remain available while another resource is pending', async () => {
    const { clock, user } = setup('/traffic');
    await user.click(screen.getByRole('button', { name: 'Close C-001' }));
    expect(screen.getByRole('button', { name: 'Close C-002' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Close C-002' }));
    await settle(clock);
    expect(screen.getByRole('button', { name: 'Open C-001' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open C-002' })).toBeVisible();
  });
  it('switching robot cancels the old preview and only renders the new result', async () => {
    const { clock, gateway, user } = setup('/fleet');
    gateway.requests.plan({ delay: 100 }, { delay: 10 });
    await user.click(screen.getByRole('button', { name: 'R-001' }));
    await user.click(screen.getByRole('button', { name: 'R-002' }));
    await settle(clock, 100);
    const inspector = screen.getByRole('complementary', { name: 'Robot inspector' });
    expect(within(inspector).getByRole('heading', { name: 'R-002' })).toBeVisible();
    expect(within(inspector).queryByRole('heading', { name: 'R-001' })).not.toBeInTheDocument();
    expect(clock.pending).toBe(0);
  });
});

it('closing an inspector restores focus to its originating robot button', async () => {
  const { user } = setup('/fleet');
  const opener = screen.getByRole('button', { name: 'R-001' });
  await user.click(opener);
  expect(screen.getByRole('button', { name: 'Close inspector' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('complementary', { name: 'Robot inspector' })).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});
it('a robot-only deep link derives the correct facility and floor', () => {
  setup('/facilities?robot=R-041');
  expect(screen.getByRole('combobox', { name: 'Operating facility' })).toHaveValue('FAC-002');
  expect(screen.getByRole('combobox', { name: 'Floor' })).toHaveValue('F-005');
});
