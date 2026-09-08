import { test, expect } from '@playwright/test';
test('service lifecycle releases active work and requires verification', async ({ page }) => {
  await page.goto('/maintenance?robot=R-001');
  await page.getByRole('button', { name: 'Start service R-001' }).click();
  await expect(page.getByRole('complementary', { name: 'Robot inspector' })).toContainText(
    'maintenance · Battery',
  );
  await page.getByRole('button', { name: 'Send for verification R-001' }).click();
  await expect(page.getByRole('button', { name: 'Complete service R-001' })).toBeVisible();
  await page.getByRole('button', { name: 'Complete service R-001' }).click();
  await expect(page.getByRole('complementary', { name: 'Robot inspector' })).toContainText(
    'paused · Battery',
  );
  await page.getByRole('link', { name: 'Execution', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'M-001 · paused' })).toBeVisible();
});

test('maintenance retains released traffic and charger reservations across workspaces', async ({
  page,
}) => {
  await page.goto('/maintenance?robot=R-001');
  await page.getByRole('button', { name: 'Start service R-001' }).click();
  await expect(page.getByRole('button', { name: 'Send for verification R-001' })).toBeVisible();
  await page.getByRole('button', { name: 'Recalculate route R-001' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Route ownership is unavailable during maintenance',
  );
  await page.getByRole('link', { name: 'Traffic', exact: true }).click();
  await expect(page.locator('.record-list li').filter({ hasText: 'R-001' })).toContainText(
    'released',
  );
  await page.getByRole('link', { name: 'Charging', exact: true }).click();
  await page.getByRole('button', { name: 'Disable CHG-001', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enable CHG-001', exact: true })).toBeVisible();
  await expect(
    page.locator('li').filter({ has: page.getByRole('button', { name: 'R-001', exact: true }) }),
  ).toContainText('released');
});
