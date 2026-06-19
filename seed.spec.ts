import { test, expect } from '@playwright/test';

test.describe('Cannastack seed', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Cannabis data, priced like an API call/i })).toBeVisible();
  });
});
