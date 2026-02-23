import { expect, test } from '@playwright/test';

test('renders auth shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Template App Chat' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
});
