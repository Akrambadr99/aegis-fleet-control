import { test, expect } from '@playwright/test';
test('facility selection survives reload and browser history', async ({ page }) => {
  await page.goto('/?source=brief');
  await page.getByRole('combobox', { name: 'Facility' }).selectOption('meridian');
  await expect(page).toHaveURL(/source=brief&facility=meridian/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Meridian Assembly' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('combobox')).toHaveValue('northstar');
  await page.goForward();
  await expect(page.getByRole('combobox')).toHaveValue('meridian');
});
test('direct workspace routes and unknown-route recovery', async ({ page }) => {
  await page.goto('/traffic');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Traffic control');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Corridor control' })).toBeVisible();
  await page.goto('/unknown');
  await page.getByRole('link', { name: 'Return to operations overview' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Operations desk');
});
test('keyboard navigation focuses the newly opened workspace', async ({ page }) => {
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Robot fleet' });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page).toHaveTitle('Robot fleet | Aegis Fleet Control');
});
test('skip link transfers keyboard focus to the main workspace', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Skip to workspace' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});
test('mobile layout remains within viewport and navigation is reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.getByRole('link', { name: 'Permissions' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roles and permissions');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
});
test('overview runs without external requests or browser errors', async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173')) external.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('combobox').selectOption('meridian');
  await expect(page.getByRole('heading', { name: 'Meridian Assembly' })).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('initial route focus does not scroll the header out of view', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
