import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest, NextResponse } from 'next/server';

import { GET as manifestGET } from '../src/app/.well-known/x402.json/route';
import { POST as retiredDealScout } from '../src/app/api/deal-scout/route';
import { POST as retiredPriceCompare } from '../src/app/api/price-compare/route';
import { POST as retiredPriceHistory } from '../src/app/api/price-history/route';
import { POST as retiredStrainFinder } from '../src/app/api/strain-finder/route';
import { GET as llmsGET } from '../src/app/llms.txt/route';
import { GET as openapiGET } from '../src/app/openapi.json/route';
import { ENDPOINTS, findEndpoint, RETIREMENT_MESSAGE } from '../src/lib/endpoints';
import { withPaymentRequiredBody } from '../src/lib/x402';
import { proxy } from '../src/proxy';

const retiredApiPaths = [
  '/api/strain-finder',
  '/api/price-compare',
  '/api/deal-scout',
  '/api/price-history',
];

const retiredHandlers = [
  retiredStrainFinder,
  retiredPriceCompare,
  retiredDealScout,
  retiredPriceHistory,
];

test('active endpoint catalog is empty', () => {
  assert.deepEqual(ENDPOINTS, []);
  assert.equal(findEndpoint('unavailable'), undefined);
});

test('OpenAPI truthfully exposes no active data paths', async () => {
  const spec = await (await openapiGET()).json();

  assert.equal(spec.info.description, RETIREMENT_MESSAGE);
  assert.deepEqual(spec.paths, {});
  assert.equal(spec['x-service-status'].status, 'retired');
  assert.equal(spec['x-service-status'].activePaidDataEndpoints, 0);
  assert.equal(spec['x-x402'].status, 'inactive');
});

test('x402 manifest has no offers or endpoint examples', async () => {
  const manifest = await (await manifestGET()).json();

  assert.equal(manifest.status, 'retired');
  assert.equal(manifest.active_paid_data_endpoints, 0);
  assert.deepEqual(manifest.endpoints, []);
  assert.deepEqual(manifest.payment, { protocol: 'x402', status: 'inactive' });
});

test('llms.txt describes only the retired state', async () => {
  const text = await (await llmsGET()).text();

  assert.match(text, /Active paid data endpoints: 0/);
  assert.match(text, /HTTP 410 Gone/);
  assert.doesNotMatch(text, /Example request|curl -X|\$0\.02/);
});

test('root JSON reports zero active paid data endpoints', async () => {
  const request = new NextRequest('https://cannastack.0x402.sh/', {
    headers: { accept: 'application/json' },
  });
  const response = proxy(request);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, 'retired');
  assert.equal(body.active_paid_data_endpoints, 0);
  assert.deepEqual(body.endpoints, []);
});

test('legacy API requests return 410 without a payment challenge', async () => {
  for (const path of retiredApiPaths) {
    const response = proxy(
      new NextRequest(`https://cannastack.0x402.sh${path}`, { method: 'POST' }),
    );
    const body = await response.json();

    assert.equal(response.status, 410, path);
    assert.equal(response.headers.has('payment-required'), false, path);
    assert.equal(body.status, 'retired', path);
  }
});

test('legacy API preflights remain browser-readable', () => {
  const response = proxy(
    new NextRequest('https://cannastack.0x402.sh/api/strain-finder', {
      method: 'OPTIONS',
    }),
  );

  assert.equal(response.status, 204);
  assert.match(response.headers.get('access-control-allow-methods') ?? '', /POST/);
});

test('legacy route handlers directly return 410 without a payment challenge', async () => {
  for (const handler of retiredHandlers) {
    const response = handler();
    assert.equal(response.status, 410);
    assert.equal(response.headers.has('payment-required'), false);
  }
});

test('generic x402 infrastructure exports no product discovery helper', async () => {
  const x402 = await import('../src/lib/x402');
  assert.equal('discoveryExtensionForDescription' in x402, false);
});

test('generic payment challenges can still be mirrored into JSON', async () => {
  const challenge = {
    x402Version: 2,
    error: 'Payment required',
    resource: {
      url: 'https://example.test/resource',
      description: 'Generic paid resource',
      mimeType: 'application/json',
    },
    accepts: [],
  };
  const encoded = Buffer.from(JSON.stringify(challenge)).toString('base64');
  const sdkResponse = NextResponse.json(
    {},
    { status: 402, headers: { 'payment-required': encoded } },
  );

  const response = withPaymentRequiredBody(sdkResponse);
  assert.equal(response.headers.get('payment-required'), encoded);
  assert.deepEqual(await response.json(), challenge);
});
