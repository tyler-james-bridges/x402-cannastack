import { expect, test } from '@playwright/test';

const legacyPages = ['/strain-finder', '/price-compare', '/deal-scout', '/price-history'];
const legacyApis = legacyPages.map((path) => `/api${path}`);

test('homepage presents the retired service state', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: 'CANNASTACK' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The data service is retired.' })).toBeVisible();
  await expect(page.getByText('0 active', { exact: true })).toBeVisible();
  await expect(page.getByText('Payment requests')).toBeVisible();
  await expect(page.locator('main input, main button')).toHaveCount(0);
});

test('homepage retirement notice is usable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'The data service is retired.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Docs' })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test('docs publishes no request contract or paid offer', async ({ page }) => {
  await page.goto('/docs');

  await expect(page.getByRole('heading', { name: /documentation has been withdrawn/i })).toBeVisible();
  await expect(page.getByText('Active paid data endpoints:')).toBeVisible();
  await expect(page.getByText('410 Gone', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '/openapi.json' })).toBeVisible();
  await expect(page.getByRole('link', { name: '/llms.txt' })).toBeVisible();
  await expect(page.getByRole('link', { name: '/.well-known/x402.json' })).toBeVisible();
});

test('status page reports a deliberate retirement state', async ({ page }) => {
  await page.goto('/status');

  await expect(page.getByRole('heading', { name: 'Public data service: retired.' })).toBeVisible();
  await expect(page.getByText('Retired by policy')).toBeVisible();
  await expect(page.getByText('0 active', { exact: true })).toBeVisible();
  await expect(page.getByText('Not issued for retired routes')).toBeVisible();
});

test('legacy human pages show a retirement notice instead of tools', async ({ page }) => {
  for (const path of legacyPages) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'This data endpoint has been retired.' })).toBeVisible();
    await expect(page.locator('main input, main button')).toHaveCount(0);
  }
});

test('root JSON exposes an empty active catalog', async ({ request }) => {
  const response = await request.get('/', { headers: { accept: 'application/json' } });
  const body = await response.json();

  expect(response.status()).toBe(200);
  expect(body.status).toBe('retired');
  expect(body.active_paid_data_endpoints).toBe(0);
  expect(body.endpoints).toEqual([]);
});

test('machine discovery surfaces expose zero paid data endpoints', async ({ request }) => {
  const [openapiResponse, manifestResponse, llmsResponse] = await Promise.all([
    request.get('/openapi.json'),
    request.get('/.well-known/x402.json'),
    request.get('/llms.txt'),
  ]);
  const openapi = await openapiResponse.json();
  const manifest = await manifestResponse.json();
  const llms = await llmsResponse.text();

  expect(openapi.paths).toEqual({});
  expect(openapi['x-service-status']).toMatchObject({ status: 'retired', activePaidDataEndpoints: 0 });
  expect(manifest).toMatchObject({ status: 'retired', active_paid_data_endpoints: 0 });
  expect(manifest.endpoints).toEqual([]);
  expect(manifest.payment).toEqual({ protocol: 'x402', status: 'inactive' });
  expect(llms).toContain('Active paid data endpoints: 0');
  expect(llms).not.toContain('Example request');
});

test('legacy API routes return 410 and never issue a 402 challenge', async ({ request }) => {
  for (const path of legacyApis) {
    const response = await request.post(path, { data: {} });

    expect(response.status(), path).toBe(410);
    expect(response.headers()['payment-required'], path).toBeUndefined();
    expect(await response.json()).toMatchObject({
      ok: false,
      status: 'retired',
      active_paid_data_endpoints: 0,
    });
  }
});

test('legacy human-route aliases no longer forward POST requests', async ({ request }) => {
  for (const path of legacyPages) {
    const response = await request.post(path, { data: {} });
    expect(response.status(), path).toBe(410);
    expect(response.headers()['payment-required'], path).toBeUndefined();
  }
});
