import { test, expect } from '@playwright/test';
test('resource contention pauses a mission and promotes its request when ownership is released', async ({
  page,
}) => {
  await page.goto('/resources');
  await page.getByRole('button', { name: 'Request RES-F-001-1', exact: true }).click();
  await expect(page.getByText('R-004 · owned')).toBeVisible();
  await page.getByLabel('Resource robot').selectOption('R-006');
  await page.getByRole('button', { name: 'Request RES-F-001-1', exact: true }).click();
  await expect(page.getByText('R-006 · queued')).toBeVisible();
  await page.getByRole('button', { name: 'Release R-004', exact: true }).click();
  await expect(page.getByText('R-006 · owned')).toBeVisible();
  await page.screenshot({ path: 'test-results/resource-control.png', fullPage: true });
});
test('resource expiration removes ownership and mission stays paused until resources are reacquired', async ({
  page,
}) => {
  await page.goto('/resources');
  await page.getByLabel('Reservation duration').fill('1');
  await page.getByRole('button', { name: 'Request RES-F-001-1', exact: true }).click();
  await expect(page.getByText('R-004 · owned')).toBeVisible();
  await page.getByRole('button', { name: 'Advance 10 seconds' }).click();
  await expect(page.getByText('No active ownership or waiting requests.')).toBeVisible();
  await page.getByRole('link', { name: 'Execution', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'M-004 · paused' })).toBeVisible();
});
