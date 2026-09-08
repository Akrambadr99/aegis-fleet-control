import { test, expect } from '@playwright/test';
test('corridor closure propagates through map, execution, activity and scenario inputs', async ({
  page,
}) => {
  await page.goto('/traffic?robot=R-001');
  await page.getByRole('button', { name: 'Close C-001' }).click();
  await expect(page.getByRole('button', { name: 'Open C-001' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Robot inspector' })).toContainText(
    'paused · Corridor closed',
  );
  await page.getByRole('link', { name: 'Digital twin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open C-001' })).toBeVisible();
  await page.getByRole('link', { name: 'Activity', exact: true }).click();
  await expect(page.getByText('corridor.set', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Simulation', exact: true }).click();
  await expect(page.getByText('C-001', { exact: true })).toBeVisible();
});
test('charger outage is visible in fleet warnings', async ({ page }) => {
  await page.goto('/charging');
  await page.getByRole('button', { name: 'Disable CHG-001' }).click();
  await expect(page.getByText('Out of service', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Robot fleet', exact: true }).click();
  await expect(
    page.getByRole('row').filter({ has: page.getByRole('button', { name: 'R-001', exact: true }) }),
  ).toContainText('Charging reservation displaced');
});
test('emergency stop produces a replay frame and persists across client navigation', async ({
  page,
}) => {
  await page.goto('/fleet?robot=R-001');
  await page.getByRole('button', { name: 'Emergency stop R-001' }).click();
  await expect(page.getByRole('complementary', { name: 'Robot inspector' })).toContainText(
    'emergency-stopped',
  );
  await page
    .getByRole('complementary', { name: 'Robot inspector' })
    .getByRole('link', { name: 'replay' })
    .click();
  await expect(page.getByText(/Mission paused · Reservation released/)).toBeVisible();
});
test('partial bulk pause preserves selection while filters change', async ({ page }) => {
  await page.goto('/fleet');
  await page.getByRole('checkbox', { name: 'Select R-001' }).check();
  await page.getByRole('checkbox', { name: 'Select R-010' }).check();
  await page.getByRole('button', { name: 'Pause selected' }).click();
  await page.getByRole('textbox', { name: 'Find robot' }).fill('R-002');
  await expect(page.getByText(/R-001: confirmed/)).toBeVisible();
  await expect(page.getByText(/R-010: failed/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'R-002', exact: true })).toBeVisible();
});
test('viewer permission blocks commands and remains consistent between workspaces', async ({
  page,
}) => {
  await page.goto('/traffic');
  await page.getByRole('combobox', { name: 'Simulation role' }).selectOption('viewer');
  await expect(page.getByRole('button', { name: 'Close C-001' })).toBeDisabled();
  await page.getByRole('link', { name: 'Charging', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Disable CHG-001' })).toBeDisabled();
});
test('simulation ticks update shared telemetry and preserve emergency stop', async ({ page }) => {
  await page.goto('/telemetry?robot=R-001');
  await page.getByRole('button', { name: 'Advance simulation' }).click();
  await expect(page.getByText(/Shared facility state · Tick 1/)).toBeVisible();
  await page.getByRole('button', { name: 'Emergency stop R-001' }).click();
  await expect(page.getByRole('complementary', { name: 'Robot inspector' })).toContainText(
    'emergency-stopped',
  );
  await page.getByRole('button', { name: 'Advance simulation' }).click();
  await expect(page.getByRole('complementary', { name: 'Robot inspector' })).toContainText(
    'emergency-stopped',
  );
});

test('operator reroutes around a closure and explicitly resumes the impacted mission', async ({
  page,
}) => {
  await page.goto('/traffic?robot=R-004');
  await page.getByRole('button', { name: 'Close C-001' }).click();
  await expect(page.getByRole('button', { name: 'Open C-001' })).toBeVisible();
  await page.getByRole('button', { name: 'Recalculate route R-004' }).click();
  await expect(
    page
      .getByRole('complementary', { name: 'Robot inspector' })
      .getByText('Feasible', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Execution', exact: true }).click();
  await page.getByRole('button', { name: 'Resume M-004' }).click();
  await expect(page.getByRole('heading', { name: 'M-004 · running', exact: true })).toBeVisible();
});
test('robot identity survives sidebar navigation to the digital twin', async ({ page }) => {
  await page.goto('/fleet?facility=FAC-002');
  await page.getByRole('button', { name: 'R-031', exact: true }).click();
  await page.getByRole('link', { name: 'Digital twin', exact: true }).click();
  await expect(page).toHaveURL(/robot=R-031/);
  await expect(
    page
      .getByRole('complementary', { name: 'Robot inspector' })
      .getByRole('heading', { name: 'R-031', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Operating facility' })).toHaveValue('FAC-002');
});

test('mobile robot inspector brings keyboard focus into view and restores it on Escape', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/facilities');
  const opener = page.getByRole('button', { name: 'R-001', exact: true }).first();
  await opener.click();
  const close = page.getByRole('button', { name: 'Close inspector' });
  await expect(close).toBeFocused();
  await expect(close).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await expect(opener).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
