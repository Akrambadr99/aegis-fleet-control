import { test, expect } from '@playwright/test';
test('acquires control, acknowledges keyboard motion and stops further motion on release', async ({
  page,
}) => {
  await page.goto('/teleoperation?robot=R-004');
  await page.getByRole('button', { name: 'Acquire control', exact: true }).click();
  await expect(page.getByText('CONTROL OWNED', { exact: true })).toBeVisible();
  const before = await page.getByTestId('control-x').textContent();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('control-x')).not.toHaveText(before!);
  await expect(page.locator('.control-receipts')).toContainText('control.move acknowledged');
  await page.screenshot({ path: 'test-results/teleoperation-console.png', fullPage: true });
  await page.getByRole('button', { name: 'Release control', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Move right' })).toBeDisabled();
  const released = await page.getByTestId('control-x').textContent();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('control-x')).toHaveText(released!);
});
test('lease expiry and connection loss remove motion eligibility', async ({ page }) => {
  await page.goto('/teleoperation?robot=R-004');
  await page.getByLabel('Control lease seconds').fill('1');
  await page.getByRole('button', { name: 'Acquire control', exact: true }).click();
  await expect(page.getByText('CONTROL OWNED', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Advance 10 seconds' }).click();
  await expect(page.getByRole('button', { name: 'Move forward' })).toBeDisabled();
  await page.getByLabel('Control lease seconds').fill('45');
  await page.getByRole('button', { name: 'Acquire control', exact: true }).click();
  await expect(page.getByText('CONTROL OWNED', { exact: true })).toBeVisible();
  await page.getByText('Simulated link state').click();
  await page.getByRole('button', { name: 'Simulate connection loss' }).click();
  await expect(page.getByText(/LINK LOST/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move forward' })).toBeDisabled();
});
test('emergency stop has distinct control styling and revokes the lease', async ({ page }) => {
  await page.goto('/teleoperation?robot=R-004');
  await page.getByRole('button', { name: 'Acquire control', exact: true }).click();
  await expect(page.getByText('CONTROL OWNED', { exact: true })).toBeVisible();
  const stop = page.getByRole('button', { name: 'Emergency stop R-004' });
  await expect(stop).toHaveClass('emergency-stop');
  await stop.click();
  await expect(page.getByRole('button', { name: 'Move forward' })).toBeDisabled();
  await expect(page.locator('.telemetry-readout')).toContainText('emergency-stopped');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/teleoperation-stopped-mobile.png', fullPage: true });
});
