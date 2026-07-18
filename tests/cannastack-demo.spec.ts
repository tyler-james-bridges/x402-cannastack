import { expect, test } from '@playwright/test';

const activeEndpoints = [
  { name: 'menu-normalize', operation: 'normalize', path: '/api/v1/menu/normalize' },
  { name: 'menu-compare', operation: 'compare', path: '/api/v1/menu/compare' },
  { name: 'menu-recommend', operation: 'recommend', path: '/api/v1/menu/recommend' },
] as const;
const legacyPages = ['/strain-finder', '/price-compare', '/deal-scout', '/price-history'];
const legacyApis = legacyPages.map((path) => `/api${path}`);

test('homepage presents the active bring-your-own-menu catalog without a demo form', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: 'CANNASTACK' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Bring your own menu/i })).toBeVisible();
  await expect(page.getByText('3 processors / $0.02 each', { exact: true })).toBeVisible();
  for (const endpoint of activeEndpoints) {
    await expect(page.getByRole('heading', { name: endpoint.name })).toBeVisible();
  }
  await expect(page.locator('main form, main input, main textarea, main button')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'OpenAPI' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Status' }).first()).toBeVisible();
});

test('active homepage remains usable at a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Bring your own menu/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'menu-recommend' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Docs', exact: true })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => ({
        tag: element.tagName,
        text: element.textContent?.trim().slice(0, 60),
        right: Math.round(element.getBoundingClientRect().right),
      }))
      .filter((element) => element.right > window.innerWidth),
  );
  expect(dimensions.content, JSON.stringify(overflow)).toBeLessThanOrEqual(dimensions.viewport);
});

test('docs explain file input, rights, payment, and all endpoint contracts', async ({ page }) => {
  await page.goto('/docs');

  await expect(page.getByRole('heading', { name: /Submit a snapshot/i })).toBeVisible();
  await expect(page.getByText('Rights attestation', { exact: true })).toBeVisible();
  await expect(page.getByText(/PAYMENT-REQUIRED header/)).toBeVisible();
  await expect(page.getByText(/payment_settlement_indeterminate/)).toBeVisible();
  await expect(page.getByText(/@authorized-menu-request\.json/).first()).toBeVisible();
  for (const endpoint of activeEndpoints) {
    await expect(page.locator(`#${endpoint.name}`)).toBeVisible();
  }
  await expect(page.locator('main form, main input, main textarea, main button')).toHaveCount(0);
  await expect(page.getByText(/sample inventory/).last()).toBeVisible();
});

test('docs fit a narrow phone viewport with accessible landmarks', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/docs');

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => ({
        tag: element.tagName,
        text: element.textContent?.trim().slice(0, 60),
        right: Math.round(element.getBoundingClientRect().right),
      }))
      .filter((element) => element.right > window.innerWidth),
  );
  expect(dimensions.content, JSON.stringify(overflow)).toBeLessThanOrEqual(dimensions.viewport);
  const docsLink = await page.getByRole('link', { name: 'Docs', exact: true }).boundingBox();
  const logoLink = await page.getByRole('link', { name: 'CANNASTACK' }).boundingBox();
  expect(docsLink?.height).toBeGreaterThanOrEqual(44);
  expect(logoLink?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByText(/Outputs make no inventory/)).toHaveCSS(
    'color',
    'rgb(145, 151, 147)',
  );
});

test('status reports the published contract without claiming network uptime', async ({ page }) => {
  await page.goto('/status');

  await expect(page.getByRole('heading', { name: /contract is published/i })).toBeVisible();
  await expect(page.getByText('3 published', { exact: true })).toBeVisible();
  await expect(page.getByText('External menu access', { exact: true })).toBeVisible();
  await expect(page.getByText('Application storage', { exact: true })).toBeVisible();
  await expect(page.getByText('410 Gone', { exact: true })).toBeVisible();
});

test('legacy human pages point to the active caller-supplied docs', async ({ page }) => {
  for (const path of legacyPages) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: 'This legacy retrieval endpoint is retired.' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bring-your-own-menu docs' })).toBeVisible();
    await expect(page.locator('main form, main input, main textarea, main button')).toHaveCount(0);
  }
});

test('root JSON exposes the published catalog, versions, links, and boundaries', async ({ request }) => {
  const response = await request.get('/', { headers: { accept: 'application/json' } });
  const body = await response.json();

  expect(response.status()).toBe(200);
  expect(body.catalog_status).toBe('published');
  expect(body.availability).toBe('not_asserted');
  expect(body.published_paid_endpoints).toBe(activeEndpoints.length);
  expect(body.endpoints.map((endpoint: { path: string }) => endpoint.path)).toEqual(
    activeEndpoints.map((endpoint) => endpoint.path),
  );
  expect(body.versions.request_schema).toBe('cannastack.byom.v1');
  expect(body.links.openapi).toBe('https://cannastack.0x402.sh/openapi.json');
  expect(body.boundaries).toMatchObject({
    input: 'caller_supplied_menu_snapshots_only',
    authorization_status: 'caller_attested_unverified',
    external_menu_data_access: false,
    payment_network_access: true,
    application_storage: false,
  });
});

test('machine discovery publishes active schemas without inventory examples', async ({ request }) => {
  const [openapiResponse, manifestResponse, llmsResponse] = await Promise.all([
    request.get('/openapi.json'),
    request.get('/.well-known/x402.json'),
    request.get('/llms.txt'),
  ]);
  const openapi = await openapiResponse.json();
  const manifest = await manifestResponse.json();
  const llms = await llmsResponse.text();

  for (const response of [openapiResponse, manifestResponse, llmsResponse]) {
    expect(response.headers()['access-control-allow-origin']).toBe('*');
  }

  expect(Object.keys(openapi.paths)).toEqual(activeEndpoints.map((endpoint) => endpoint.path));
  expect(openapi['x-service-status']).toMatchObject({
    contract: 'published',
    availability: 'not_asserted',
    publishedPaidEndpoints: activeEndpoints.length,
    externalMenuDataAccess: false,
    applicationStorage: false,
  });
  for (const endpoint of activeEndpoints) {
    const operation = openapi.paths[endpoint.path].post;
    const requestRef = operation.requestBody.content['application/json'].schema.$ref;
    const responseRef = operation.responses['200'].content['application/json'].schema.$ref;
    expect(openapi.components.schemas[requestRef.split('/').at(-1)]).toBeTruthy();
    expect(openapi.components.schemas[responseRef.split('/').at(-1)]).toBeTruthy();
    expect(Object.keys(operation.responses)).toEqual(
      expect.arrayContaining(['200', '400', '402', '403', '413', '415', '422', '502', '503']),
    );
    expect(operation.responses['402'].headers['PAYMENT-REQUIRED']).toBeTruthy();
    expect(operation.responses['200'].headers['PAYMENT-RESPONSE']).toBeTruthy();
    expect(operation.parameters[0].name).toBe('PAYMENT-SIGNATURE');
  }
  expect(JSON.stringify(openapi)).not.toMatch(/"examples?":/u);

  expect(manifest.catalog_format).toBe('cannastack.service-catalog.v1');
  expect(manifest.catalog_status).toBe('published');
  expect(manifest.published_paid_endpoints).toBe(activeEndpoints.length);
  expect(manifest.payment.official_protocol_manifest).toBe(false);
  expect(manifest.endpoints).toHaveLength(activeEndpoints.length);
  for (const endpoint of manifest.endpoints) {
    expect(endpoint).toMatchObject({ price: '$0.02', network: 'eip155:8453', scheme: 'exact' });
    expect(endpoint.request_schema).toBeTruthy();
    expect(endpoint.response_schema).toBeTruthy();
    expect(endpoint.semantics).toMatchObject({
      external_menu_data_access: false,
      external_menu_data_used: false,
      processing: 'transient_no_application_storage',
    });
  }
  expect(JSON.stringify(manifest)).not.toMatch(/"examples?":/u);
  expect(llms).toContain('@authorized-menu-request.json');
  expect(llms).toContain('caller-attested and unverified');
  expect(llms).toContain('HTTP 410 Gone');
  expect(llms).not.toContain('Example request');
});

test('unauthorized active requests return 403 without payment or facilitator access', async ({ request }) => {
  for (const endpoint of activeEndpoints) {
    const response = await request.post(endpoint.path, {
      data: {
        schema_version: 'cannastack.byom.v1',
        data_authorization: null,
        menus: [],
      },
    });

    expect(response.status(), endpoint.path).toBe(403);
    expect(response.headers()['payment-required'], endpoint.path).toBeUndefined();
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: 'data_authorization_required' },
    });
  }
});

test('legacy API routes return 410 and never issue a payment challenge', async ({ request }) => {
  for (const path of legacyApis) {
    const response = await request.post(path, { data: {} });

    expect(response.status(), path).toBe(410);
    expect(response.headers()['payment-required'], path).toBeUndefined();
    expect(await response.json()).toMatchObject({
      ok: false,
      status: 'retired',
      published_paid_endpoints: activeEndpoints.length,
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

test('active and legacy CORS preflights are uncharged and browser-readable', async ({ request }) => {
  for (const path of [...activeEndpoints.map((endpoint) => endpoint.path), ...legacyApis]) {
    const response = await request.fetch(path, { method: 'OPTIONS' });
    const headers = response.headers();

    expect(response.status(), path).toBe(204);
    expect(headers['access-control-allow-origin'], path).toBe('*');
    expect(headers['access-control-allow-methods'], path).toContain('POST');
    expect(headers['payment-required'], path).toBeUndefined();
  }
});
