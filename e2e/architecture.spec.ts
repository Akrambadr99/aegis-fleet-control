import { test, expect } from '@playwright/test';
test('search keyboard navigation opens canonical entity context', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Search fleet', { exact: true }).click();
  await page.getByLabel('Search all operations').fill('R-001');
  await page.screenshot({ path: 'test-results/architecture-search.png', fullPage: true });
  await page.getByLabel('Search all operations').press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/robot=R-001/);
  await expect(page.getByRole('complementary', { name: 'Robot inspector' })).toContainText('R-001');
});
test('diagnostics traces a command and activity derives its operational alert', async ({
  page,
}) => {
  await page.goto('/fleet?robot=R-001');
  await page.getByRole('button', { name: 'Emergency stop R-001' }).click();
  await expect(page.getByRole('complementary', { name: 'Robot inspector' })).toContainText(
    'emergency-stopped',
  );
  await page.getByRole('link', { name: /Activity/ }).click();
  await expect(page.getByRole('region', { name: 'Operational alerts' })).toContainText('R-001');
  await page.getByRole('link', { name: 'Local diagnostics' }).click();
  await expect(page.getByRole('heading', { name: 'Local diagnostics' })).toBeVisible();
  await expect(page.locator('main')).toContainText('robot.stop');
  await expect(page.locator('main')).toContainText('confirmed');
  await expect(page.locator('main')).toContainText('All checked invariants hold');
  await page.screenshot({ path: 'test-results/architecture-diagnostics.png', fullPage: true });
});
test('renewing control extends the active lease without changing its owner', async ({ page }) => {
  await page.goto('/teleoperation?robot=R-004');
  await page.getByLabel('Control lease seconds').fill('15');
  await page.getByRole('button', { name: 'Acquire control', exact: true }).click();
  await expect(page.getByText('CONTROL OWNED', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Advance 10 seconds' }).click();
  await page.getByRole('button', { name: 'Renew control lease' }).click();
  await expect(page.locator('.ownership-strip')).toContainText('15s remaining');
  await page.getByRole('button', { name: 'Advance 10 seconds' }).click();
  await expect(page.getByRole('button', { name: 'Move forward' })).toBeEnabled();
});
