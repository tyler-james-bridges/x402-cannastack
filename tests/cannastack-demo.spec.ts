import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { ENDPOINTS } from '../src/lib/endpoints';

const endpointNames = ['strain-finder', 'price-compare', 'deal-scout', 'price-history'] as const;

async function tileDemoWindow(page: Page, workerIndex: number) {
  if (process.env.PLAYWRIGHT_TILE_WINDOWS !== '1') return;

  const column = workerIndex % 2;
  const row = Math.floor(workerIndex / 2);
  const bounds = {
    left: 20 + column * 740,
    top: 48 + row * 48,
    width: 720,
    height: 900,
  };

  let session: CDPSession | undefined;
  try {
    session = await page.context().newCDPSession(page);
    const { windowId } = await session.send('Browser.getWindowForTarget');
    await session.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'normal' },
    });
    await session.send('Browser.setWindowBounds', { windowId, bounds });
  } catch {
    // Best effort only. Some browsers/environments do not expose window bounds.
  } finally {
    await session?.detach().catch(() => undefined);
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  await tileDemoWindow(page, testInfo.workerIndex);
});

function endpoint(name: (typeof endpointNames)[number]) {
  const spec = ENDPOINTS.find((item) => item.name === name);
  if (!spec) throw new Error(`Missing endpoint fixture: ${name}`);
  return spec;
}

async function mockAnalytics(page: Page) {
  await page.route('**/api/analytics', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        total_requests: 4,
        reqs_24h: 4,
        usdc_24h: 0.08,
        by_endpoint: endpointNames.map((name) => ({ endpoint: name, cnt: 1, avg_ms: 120 })),
        top_locations: [{ location_query: 'Denver, CO', cnt: 1 }],
        top_strains: [{ strain: 'Blue Dream', cnt: 1 }],
        recent: [],
      }),
    });
  });
}

async function mockEndpoint(page: Page, name: (typeof endpointNames)[number]) {
  const spec = endpoint(name);
  await page.route(`**/api/${name}`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'x-cannastack-version': '1',
        'x-price-usdc': spec.price_usdc.toFixed(2),
      },
      body: JSON.stringify(spec.example_response),
    });
  });
}

test('homepage orients humans and agents', async ({ page }) => {
  await mockAnalytics(page);

  await page.goto('/');

  await expect(page.getByText('CANNASTACK').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Cannabis data, priced like an API call/i })).toBeVisible();
  await expect(page.getByPlaceholder('find Blue Dream near Denver under $30')).toBeVisible();
  await expect(page.getByRole('link', { name: 'docs' }).first()).toBeVisible();

  for (const name of endpointNames) {
    await expect(page.getByText(name).first()).toBeVisible();
  }
  await expect(page.getByText('$0.02').first()).toBeVisible();
});

test('homepage prompt routes natural language before submit', async ({ page }) => {
  await mockAnalytics(page);

  await page.goto('/');

  const prompt = page.getByPlaceholder('find Blue Dream near Denver under $30');
  await expect(page.getByText('/strain-finder', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'deals near Las Vegas tonight' }).click();
  await expect(prompt).toHaveValue('deals near Las Vegas tonight');
  await expect(page.getByText('/deal-scout', { exact: true }).first()).toBeVisible();

  await prompt.fill('???');
  await expect(page.getByRole('button', { name: /RUN/i })).toBeDisabled();
});

test('homepage preview call renders a successful metered result', async ({ page }) => {
  await mockAnalytics(page);
  await mockEndpoint(page, 'strain-finder');
  const strainExample = endpoint('strain-finder').example_response as {
    results: { dispensary: string }[];
    summary: string;
  };

  await page.goto('/');
  await page.getByRole('button', { name: /RUN/i }).click();

  await expect(page.getByText('200 OK').first()).toBeVisible();
  await expect(page.getByText(strainExample.results[0].dispensary).first()).toBeVisible();
  await expect(page.getByText(strainExample.summary)).toBeVisible();
  await expect(page.getByText(/settled/i).first()).toBeVisible();
});

test('docs page exposes the contract and discovery links', async ({ page }) => {
  await mockAnalytics(page);

  await page.goto('/docs');

  await expect(page.getByRole('heading', { name: /API reference/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quick start' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'openapi.json' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'llms.txt' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'x402.json' })).toBeVisible();

  for (const name of endpointNames) {
    await expect(page.locator(`section#${name}`)).toBeVisible();
    await expect(page.locator(`section#${name}`).getByText('$0.02 per call')).toBeVisible();
  }
});

test('strain finder page validates required fields and wallet prerequisite', async ({ page }) => {
  await mockAnalytics(page);
  const strainRequest = endpoint('strain-finder').example_request as {
    strain: string;
    location: string;
  };

  await page.goto('/strain-finder');

  const submit = page.getByRole('button', { name: /FIND/i });
  await expect(submit).toBeDisabled();

  await page.getByPlaceholder('Strain name (e.g. Blue Dream)').fill(strainRequest.strain);
  await page.getByPlaceholder('City or address (US only)').fill(strainRequest.location);
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByText('Connect a wallet to pay $0.02 in USDC and run this search.')).toBeVisible();
});

test('price history shows client-side validation errors', async ({ page }) => {
  await mockAnalytics(page);

  await page.goto('/price-history');

  await page.getByRole('button', { name: /SEARCH/i }).click();
  await expect(page.getByText('Enter a strain name')).toBeVisible();

  await page.getByRole('button', { name: /BY DISPENSARY/i }).click();
  await page.getByRole('button', { name: /SEARCH/i }).click();
  await expect(page.getByText('Enter a dispensary name')).toBeVisible();
});

test('agent can discover endpoint contracts through OpenAPI', async ({ request }) => {
  const response = await request.get('/openapi.json');
  expect(response.ok()).toBeTruthy();

  const spec = await response.json();
  expect(spec.openapi).toBe('3.1.0');
  expect(spec.info.title).toBe('cannastack');
  expect(spec['x-x402'].payment.protocol).toBe('x402');

  for (const name of endpointNames) {
    const path = endpoint(name).path;
    expect(spec.paths[path].post.operationId).toBe(name.replace(/-/g, '_'));
    expect(spec.paths[path].post['x-x402-price-usdc']).toBe(0.02);
  }
});

test('agent can discover payment metadata through x402 manifest', async ({ request }) => {
  const response = await request.get('/.well-known/x402.json');
  expect(response.ok()).toBeTruthy();

  const manifest = await response.json();
  expect(manifest.name).toBe('cannastack');
  expect(manifest.payment.protocol).toBe('x402');
  expect(manifest.endpoints).toHaveLength(4);

  for (const name of endpointNames) {
    const item = manifest.endpoints.find((entry: { name: string }) => entry.name === name);
    expect(item).toMatchObject({ method: 'POST', price_usdc: 0.02 });
    expect(item.url).toContain(endpoint(name).path);
    expect(item.example).toEqual(endpoint(name).example_request);
  }
});

test('agent receives an x402 payment challenge from paid endpoints', async ({ request }) => {
  const response = await request.post('/api/strain-finder', {
    data: endpoint('strain-finder').example_request,
  });

  expect(response.status()).toBe(402);

  expect(response.headers()['content-type']).toContain('application/json');
});

test('API preflight advertises CORS support for agent clients', async ({ request }) => {
  const response = await request.fetch('/api/strain-finder', { method: 'OPTIONS' });

  expect(response.status()).toBe(204);
  expect(response.headers()['access-control-allow-origin']).toBe('*');
  expect(response.headers()['access-control-allow-methods']).toContain('POST');
  expect(response.headers()['access-control-allow-headers']).toContain('content-type');
});
