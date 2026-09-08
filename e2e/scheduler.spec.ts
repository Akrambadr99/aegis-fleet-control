import { test, expect } from '@playwright/test';
test('dispatch creates linked execution and records partial delivery', async ({ page }) => {
  await page.goto('/scheduler');
  await expect(page.getByText('Robot has active mission workload').first()).toBeVisible();
  await page.getByRole('button', { name: 'Advance 100 seconds' }).click();
  await expect(page.getByRole('button', { name: 'Assign best candidate' })).toBeEnabled();
  await page.getByLabel('Batch units').fill('2');
  await page.getByRole('button', { name: 'Assign best candidate' }).click();
  await expect(
    page.getByText(
      'Last decision: Automatic ranking: shortest eligible delivery with battery reserve',
    ),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/scheduler-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Advance 100 seconds' }).click();
  await expect(page.locator('.job-queue tr').filter({ hasText: 'JOB-001' })).toContainText('2/4');
  await expect(page.locator('.job-queue tr').filter({ hasText: 'JOB-001' })).toContainText(
    'partially-completed',
  );
  await page.getByRole('link', { name: 'Execution', exact: true }).click();
  await expect(page.getByRole('heading', { name: /M-JOB-001.*completed/ })).toBeVisible();
});
test('creates a real warehouse job and can cancel unassigned work with a reason', async ({
  page,
}) => {
  await page.goto('/scheduler');
  await page.getByRole('button', { name: 'New warehouse job' }).click();
  await page.getByLabel('Job title').fill('Dock 08 replenishment');
  await page.getByRole('button', { name: 'Create job', exact: true }).click();
  await expect(page.locator('.job-queue')).toContainText('Dock 08 replenishment');
  await page.getByLabel('Cancellation reason').fill('Shipment withdrawn');
  await page.getByRole('button', { name: /Cancel job JOB-/ }).click();
  await expect(
    page.locator('.job-queue tr').filter({ hasText: 'Dock 08 replenishment' }),
  ).toContainText('cancelled');
});
