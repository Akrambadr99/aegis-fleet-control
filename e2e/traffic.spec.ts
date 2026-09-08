import { test, expect } from '@playwright/test';
test('traffic map exposes live route layers and contextual robot inspection', async ({ page }) => {
  await page.goto('/traffic');
  const map = page.getByRole('img', { name: 'Spatial traffic and resource ownership' });
  await expect(map.locator('[data-route]')).toHaveCount(10);
  await page.getByRole('checkbox', { name: 'routes', exact: true }).uncheck();
  await expect(map.locator('[data-route]')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'routes', exact: true }).check();
  await page.getByRole('button', { name: 'Inspect robot R-004', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('complementary', { name: 'Robot inspector' })).toContainText('R-004');
  await page.getByRole('button', { name: 'Close C-001', exact: true }).click();
  await expect(map).toContainText('C-001 CLOSED');
  await expect(page.getByRole('complementary', { name: 'Robot inspector' })).toContainText(
    'paused',
  );
  await page.screenshot({ path: 'test-results/spatial-traffic.png', fullPage: true });
});
test('traffic inspector displays the same resource owner as resource control', async ({ page }) => {
  await page.goto('/resources');
  await page.getByRole('button', { name: 'Request RES-F-001-1', exact: true }).click();
  await expect(page.getByText('R-004 · owned')).toBeVisible();
  await page.getByRole('link', { name: 'Traffic', exact: true }).click();
  await page.getByRole('button', { name: 'Inspect resource RES-F-001-1', exact: true }).click();
  await expect(page.getByText('R-004 · owned')).toBeVisible();
  await page.getByRole('button', { name: 'Release R-004', exact: true }).click();
  await expect(page.getByText('No active ownership or waiting requests.')).toBeVisible();
});
