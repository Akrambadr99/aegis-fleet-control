import { test, expect } from '@playwright/test';
test('mission editor saves dependencies and conditions, duplicates and preserves original', async ({
  page,
}) => {
  await page.goto('/missions');
  await page.getByLabel('Mission title').fill('Dock 04 inspection');
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByLabel('Step type').selectOption('inspect');
  await page.getByLabel('Run condition').selectOption('battery-low');
  await page.getByRole('button', { name: 'Save mission', exact: true }).click();
  await expect(page.getByText('Mission plan saved')).toBeVisible();
  await page.getByRole('button', { name: 'Duplicate mission' }).click();
  await expect(page.getByLabel('Mission title')).toHaveValue('Dock 04 inspection copy');
  await page.getByRole('button', { name: 'Save mission', exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Saved mission plans' }).getByRole('button'),
  ).toHaveCount(3);
  await page
    .getByRole('navigation', { name: 'Saved mission plans' })
    .getByRole('button', { name: 'Dock 04 inspection R-001 · rev 1', exact: true })
    .click();
  await expect(page.getByLabel('Mission title')).toHaveValue('Dock 04 inspection');
  await page.screenshot({ path: 'test-results/mission-editor-desktop.png', fullPage: true });
});
test('drag ordering, undo and cancellation retain complete mission snapshots', async ({ page }) => {
  await page.goto('/missions');
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByRole('button', { name: 'Add step' }).click();
  const rows = page.getByRole('region', { name: 'Mission step sequence' }).locator('li');
  await rows.nth(1).dragTo(rows.nth(0));
  await expect(rows.first()).toContainText('S-2');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(rows.first()).toContainText('S-1');
  await page.getByRole('button', { name: 'Cancel draft' }).click();
  await expect(page.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel draft' }).click();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(rows).toHaveCount(0);
});
test('invalid draft disables save and mission editor fits a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/missions');
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.getByLabel('Step type').selectOption('pickup');
  await expect(page.getByText('S-1: Robot cannot handle this payload')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save mission', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mission-editor-mobile.png', fullPage: true });
});
