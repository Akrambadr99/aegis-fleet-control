import { test, expect } from '@playwright/test';
test('released dispatch keeps its mission history and can be retried from the queue', async ({
  page,
}) => {
  await page.goto('/scheduler');
  await page.getByRole('button', { name: 'Advance 100 seconds' }).click();
  await page.getByRole('button', { name: 'Assign best candidate' }).click();
  await page.getByLabel('Release reason').fill('Dock unavailable until next shift');
  await page.getByRole('button', { name: 'Release assignment', exact: true }).click();
  const history = page.getByRole('region', { name: 'Job mission history' });
  await expect(history).toContainText('Attempt released');
  await expect(history).toContainText('Dock unavailable until next shift');
  await page.getByRole('button', { name: 'Assign best candidate' }).click();
  await expect(history.locator('li')).toHaveCount(2);
  await expect(history).toContainText('Attempt active');
  await page.getByRole('button', { name: 'Advance 100 seconds' }).click();
  await expect(history).toContainText('Attempt completed');
});
test('inspection job requirements persist and filter robot capability eligibility', async ({
  page,
}) => {
  await page.goto('/scheduler');
  await page.getByRole('button', { name: 'New warehouse job' }).click();
  await page.getByLabel('Job title').fill('Outbound inspection sweep');
  await page.getByRole('combobox', { name: 'Job kind', exact: true }).selectOption('inspection');
  await expect(page.getByLabel('Payload kg')).toHaveValue('0');
  await expect(page.getByLabel('Payload kg')).toBeDisabled();
  await expect(page.getByText('Required capabilities: navigate, inspect')).toBeVisible();
  await page.getByRole('checkbox', { name: 'lift', exact: true }).check();
  await page.getByRole('button', { name: 'Create job', exact: true }).click();
  await expect(
    page.locator('.job-queue tr').filter({ hasText: 'Outbound inspection sweep' }),
  ).toContainText('Inspection');
  await expect(page.getByRole('combobox', { name: 'Job kind', exact: true })).toHaveValue(
    'inspection',
  );
  await expect(page.getByText(/Required capability: lift/).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/inspection-job.png', fullPage: true });
});
test('queue filters survive reload and dependency navigation preserves query context', async ({
  page,
}) => {
  await page.goto('/scheduler?facility=FAC-001&job=JOB-001&keep=yes');
  await page.getByLabel('Search jobs').fill('JOB-002');
  await page.getByRole('combobox', { name: 'Job status', exact: true }).selectOption('queued');
  await expect(page.getByText('1 of 2 jobs shown')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Search jobs')).toHaveValue('JOB-002');
  await page
    .getByRole('region', { name: 'Job dependency graph' })
    .getByRole('button', { name: 'JOB-002' })
    .click();
  await expect(page).toHaveURL(/job=JOB-002/);
  await expect(page).toHaveURL(/keep=yes/);
  await expect(page.getByRole('combobox', { name: 'Job status', exact: true })).toHaveValue(
    'queued',
  );
});
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
