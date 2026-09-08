import { test, expect } from '@playwright/test';
test('enabled automation reacts to real topology changes and records per-robot outcomes', async ({
  page,
}) => {
  await page.goto('/automation?rule=AUTO-ROUTE');
  await page.getByRole('button', { name: 'Enable AUTO-ROUTE', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Disable AUTO-ROUTE', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Traffic', exact: true }).click();
  await page.getByRole('button', { name: 'Close C-001', exact: true }).click();
  await expect(page.locator('.record-list li').filter({ hasText: 'R-004' })).toContainText(
    'valid · held',
  );
  await page.getByRole('link', { name: 'Automation', exact: true }).click();
  await expect(page.locator('.automation-history')).toContainText('confirmed');
  await page.getByLabel('Recorded event').selectOption({ index: 1 });
  const rows = await page.locator('.automation-history tbody tr').count();
  await page.getByRole('button', { name: 'Test current rule' }).click();
  await expect(page.getByText('Evaluation complete · No actions executed')).toBeVisible();
  expect(await page.locator('.automation-history tbody tr').count()).toBe(rows);
  await page.screenshot({ path: 'test-results/automation-rules.png', fullPage: true });
});
test('rule editor blocks invalid cooldown and saves a scoped rule', async ({ page }) => {
  await page.goto('/automation');
  await page.getByRole('button', { name: 'New rule', exact: true }).click();
  await page.getByLabel('Rule name').fill('Escalate repeated stops');
  await page.getByLabel('When event').selectOption('robot.stop');
  await page.getByLabel('Then action').selectOption('escalate');
  await page.getByLabel('Cooldown seconds').fill('0');
  await expect(page.getByRole('button', { name: 'Save rule', exact: true })).toBeDisabled();
  await page.getByLabel('Cooldown seconds').fill('30');
  await page.getByRole('button', { name: 'Save rule', exact: true }).click();
  await expect(page.locator('.rule-library')).toContainText('Escalate repeated stops');
});
