import { test, expect } from '@playwright/test';
test('seeks and plays recorded movement without changing live state', async ({ page }) => {
  await page.goto('/fleet?robot=R-004');
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Advance simulation', exact: true }).click();
  await page.getByRole('link', { name: 'Replay', exact: true }).click();
  const latest = await page.getByTestId('replay-position').textContent();
  await page.getByRole('button', { name: 'Go to start' }).click();
  await expect(page.getByTestId('replay-position')).not.toHaveText(latest!);
  await page.getByLabel('Playback speed').selectOption('4');
  await page.getByRole('button', { name: 'Play recording' }).click();
  await expect(page.getByRole('button', { name: 'Play recording' })).toBeVisible();
  await expect(page.getByTestId('replay-position')).toHaveText(latest!);
  await expect(page.getByText(/Live tick 4/)).toBeVisible();
  await page.screenshot({ path: 'test-results/mission-replay.png', fullPage: true });
});
test('event markers reconstruct stop state while earlier frames retain running state', async ({
  page,
}) => {
  await page.goto('/fleet?robot=R-004');
  await page.getByRole('button', { name: 'Advance simulation', exact: true }).click();
  await page.getByRole('button', { name: 'Emergency stop R-004' }).click();
  await expect(page.getByRole('complementary', { name: 'Robot inspector' })).toContainText(
    'emergency-stopped',
  );
  await page.getByRole('link', { name: 'Replay', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Recorded robot state' })).toContainText(
    'emergency-stopped',
  );
  await page.getByRole('button', { name: 'Go to start' }).click();
  await expect(page.getByRole('complementary', { name: 'Recorded robot state' })).toContainText(
    'running',
  );
  await page.getByRole('button', { name: 'Tick 1 · robot.stop', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Recorded robot state' })).toContainText(
    'emergency-stopped',
  );
});
