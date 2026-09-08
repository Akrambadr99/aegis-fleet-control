import { test, expect } from '@playwright/test';
test('facility grant persists across navigation while other facilities remain viewable', async ({
  page,
}) => {
  await page.goto('/traffic');
  await page.getByRole('combobox', { name: 'Control scope' }).selectOption('FAC-001');
  await expect(page.getByRole('button', { name: 'Close C-001' })).toBeEnabled();
  await page.getByRole('combobox', { name: 'Operating facility' }).selectOption('FAC-002');
  await expect(page.getByRole('button', { name: 'Close C-010' })).toBeDisabled();
  await expect(page.getByText('This facility is outside your control scope').first()).toBeVisible();
  await page.getByRole('link', { name: 'Charging', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Disable CHG-010' })).toBeDisabled();
  await page.getByRole('link', { name: 'Robot fleet', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select R-031' }).check();
  await expect(page.getByRole('button', { name: 'Pause selected' })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Operating facility' }).selectOption('FAC-001');
  await page.getByRole('checkbox', { name: 'Select R-001' }).check();
  await expect(page.getByRole('button', { name: 'Pause selected' })).toBeEnabled();
});
test('operator can inspect before and after records of a cross-domain command', async ({
  page,
}) => {
  await page.goto('/traffic');
  await page.getByRole('button', { name: 'Close C-001' }).click();
  await expect(page.getByRole('button', { name: 'Open C-001' })).toBeVisible();
  await page.getByRole('link', { name: 'Activity', exact: true }).click();
  await page
    .getByText(/Inspect changes/)
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'corridors / C-001' })).toBeVisible();
  const change = page
    .locator('.audit-change')
    .filter({ has: page.getByRole('heading', { name: 'corridors / C-001' }) });
  await expect(change).toContainText('"open": true');
  await expect(change).toContainText('"open": false');
  await expect(page.getByRole('heading', { name: 'missions / M-001' })).toBeVisible();
});
