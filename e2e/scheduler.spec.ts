import { test, expect } from '@playwright/test';
test('acquiring a dispatch lock preserves an unsaved job edit and its subsequent save', async ({
  page,
}) => {
  await page.goto('/scheduler');
  await page.getByLabel('Job title').fill('Protected outbound plan');
  await page.getByLabel('Dispatch lock reason').fill('Editing assignment requirements');
  await page.getByRole('button', { name: 'Acquire dispatch lock' }).click();
  await expect(page.getByRole('region', { name: 'Dispatch ownership' })).toContainText(
    'local-operator owns dispatch',
  );
  await expect(page.getByLabel('Job title')).toHaveValue('Protected outbound plan');
  await page.getByRole('button', { name: 'Save job requirements' }).click();
  await expect(page.locator('.job-queue')).toContainText('Protected outbound plan');
});
test('dispatch ownership can be acquired, renewed and released from the scheduler', async ({
  page,
}) => {
  await page.goto('/scheduler');
  const panel = page.getByRole('region', { name: 'Dispatch ownership' });
  await panel.getByLabel('Dispatch lock reason').fill('Preparing outbound batch');
  await panel.getByRole('button', { name: 'Acquire dispatch lock' }).click();
  await expect(panel).toContainText('local-operator owns dispatch until tick 120');
  await panel.getByLabel('Lock duration seconds').fill('240');
  await panel.getByRole('button', { name: 'Renew dispatch lock' }).click();
  await expect(panel).toContainText('local-operator owns dispatch until tick 240');
  await panel.getByRole('button', { name: 'Release dispatch lock' }).click();
  await expect(panel).toContainText('No active dispatcher lock');
});
test('dispatch group holds block new assignments until explicitly released', async ({ page }) => {
  await page.goto('/scheduler');
  await page.getByRole('button', { name: 'Advance 100 seconds' }).click();
  await page.getByLabel('Select JOB-001 for dispatch').check();
  await page.getByText('Dispatch groups · 0', { exact: true }).click();
  await page.getByLabel('Dispatch group title').fill('Outbound morning wave');
  await page.getByRole('button', { name: 'Group selected jobs', exact: true }).click();
  const group = page.getByRole('article', { name: 'Dispatch group Outbound morning wave' });
  await group.getByLabel('Group decision reason').fill('Waiting for loading bay');
  await group.getByRole('button', { name: 'Hold group', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Assign best candidate' })).toBeDisabled();
  await expect(page.getByText(/Dispatch group is not released/).first()).toBeVisible();
  await group.getByRole('button', { name: 'View group jobs' }).click();
  await expect(page).toHaveURL(/jobGroup=GROUP-/);
  await expect(page.getByText('1 of 2 jobs shown')).toBeVisible();
  await group.getByRole('button', { name: 'Release group', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Assign best candidate' })).toBeEnabled();
});
test('batch dispatch reports partial success and survives workspace navigation', async ({
  page,
}) => {
  await page.goto('/scheduler');
  await page.getByRole('button', { name: 'Advance 100 seconds' }).click();
  await page.getByLabel('Select JOB-001 for dispatch').check();
  await page.getByLabel('Select JOB-002 for dispatch').check();
  await page.getByRole('button', { name: 'Dispatch selected jobs', exact: true }).click();
  await expect(page.getByText('1 confirmed · 1 failed')).toBeVisible();
  await page.getByRole('link', { name: 'Execution', exact: true }).click();
  await page.getByRole('link', { name: 'Scheduler', exact: true }).click();
  await expect(page.getByText('1 confirmed · 1 failed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry failed jobs' })).toBeEnabled();
});
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
