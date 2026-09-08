import { test, expect } from '@playwright/test';
test('digital twin keeps floor layers and zoom while robot markers open the shared inspector', async ({
  page,
}) => {
  await page.goto('/facilities');
  await page.getByRole('button', { name: 'Zoom digital twin in' }).click();
  await expect(page.getByLabel('Digital twin zoom')).toHaveText('125%');
  await page.getByLabel('Navigation nodes', { exact: true }).uncheck();
  const marker = page.getByRole('button', { name: 'Inspect robot R-004', exact: true });
  await marker.focus();
  await marker.press('Enter');
  await expect(page.getByRole('complementary', { name: 'Robot inspector' })).toContainText('R-004');
  await page.getByRole('link', { name: 'Robot fleet', exact: true }).click();
  await page.getByRole('link', { name: 'Digital twin', exact: true }).click();
  await expect(page.getByLabel('Digital twin zoom')).toHaveText('125%');
  await expect(page.getByLabel('Navigation nodes', { exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Fit floor', exact: true }).click();
  await expect(page.getByLabel('Digital twin zoom')).toHaveText('100%');
});
