import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest, NextResponse } from 'next/server';

import { GET as manifestGET } from '../src/app/.well-known/x402.json/route';
import {
  OPTIONS as activeOptions,
  POST as activeNormalize,
} from '../src/app/api/v1/menu/normalize/route';
import { POST as retiredDealScout } from '../src/app/api/deal-scout/route';
import { POST as retiredPriceCompare } from '../src/app/api/price-compare/route';
import { POST as retiredPriceHistory } from '../src/app/api/price-history/route';
import { POST as retiredStrainFinder } from '../src/app/api/strain-finder/route';
import { GET as llmsGET } from '../src/app/llms.txt/route';
import { GET as openapiGET } from '../src/app/openapi.json/route';
import { ENDPOINTS, findEndpoint } from '../src/lib/endpoints';
import {
  DATA_RIGHTS_VERSION,
  MENU_RULESET_VERSION,
  MENU_SCHEMA_VERSION,
} from '../src/lib/menu-contract';
import { BASE_USDC, withPaymentRequiredBody } from '../src/lib/x402';
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

test('active endpoint catalog exposes three source-neutral paid tools', () => {
  assert.deepEqual(
    ENDPOINTS.map(({ path, price, price_usdc, network }) => ({
      path,
      price,
      price_usdc,
      network,
    })),
    [
      {
        path: '/api/v1/menu/normalize',
        price: '$0.02',
        price_usdc: 0.02,
        network: 'eip155:8453',
      },
      {
        path: '/api/v1/menu/compare',
        price: '$0.02',
        price_usdc: 0.02,
        network: 'eip155:8453',
      },
      {
        path: '/api/v1/menu/recommend',
        price: '$0.02',
        price_usdc: 0.02,
        network: 'eip155:8453',
      },
    ],
  );
  assert.equal(findEndpoint('menu-normalize')?.method, 'POST');
  assert.equal(findEndpoint('unavailable'), undefined);
  for (const endpoint of ENDPOINTS) {
    assert.equal(endpoint.asset, 'USDC');
    assert.equal(endpoint.scheme, 'exact');
    assert.equal(endpoint.request_schema.additionalProperties, false);
    assert.equal(endpoint.response_schema.additionalProperties, false);
    assert.doesNotMatch(JSON.stringify(endpoint), /"examples?":/u);
  }
});

test('OpenAPI exposes every active schema and uncharged validation response', async () => {
  const response = await openapiGET();
  const spec = await response.json();

  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal(spec.openapi, '3.1.0');
  assert.deepEqual(Object.keys(spec.paths), ENDPOINTS.map((endpoint) => endpoint.path));
  assert.equal(spec['x-service-status'].contract, 'published');
  assert.equal(spec['x-service-status'].availability, 'not_asserted');
  assert.equal(spec['x-service-status'].publishedPaidEndpoints, ENDPOINTS.length);

  for (const endpoint of ENDPOINTS) {
    const operation = spec.paths[endpoint.path].post;
    const requestRef = operation.requestBody.content['application/json'].schema.$ref;
    const responseRef = operation.responses['200'].content['application/json'].schema.$ref;
    const requestSchema = spec.components.schemas[requestRef.split('/').at(-1)];
    const responseSchema = spec.components.schemas[responseRef.split('/').at(-1)];

    assert.equal(operation['x-x402'].price, endpoint.price);
    assert.equal(operation['x-x402'].network, endpoint.network);
    assert.equal(requestSchema.properties.schema_version.const, MENU_SCHEMA_VERSION);
    assert.equal(requestSchema.additionalProperties, false);
    assert.equal(responseSchema.properties.operation.const, endpoint.operation);
    assert.equal(responseSchema.additionalProperties, false);
    for (const status of ['400', '403', '413', '415', '422']) {
      assert.match(operation.responses[status].description, /^Uncharged\./u);
    }
    assert.ok(operation.responses['402'].headers['PAYMENT-REQUIRED']);
    assert.equal(
      operation.responses['402']['x-body-mirrors-header'],
      'PAYMENT-REQUIRED',
    );
    assert.ok(operation.responses['502']);
    assert.ok(operation.responses['503']);
    assert.equal(operation.parameters[0].name, 'PAYMENT-SIGNATURE');
    assert.ok(operation.responses['200'].headers['PAYMENT-RESPONSE']);
    assert.ok(operation.responses['502'].headers['PAYMENT-RESPONSE']);
  }

  assert.doesNotMatch(JSON.stringify(spec), /"examples?":/u);
});

test('Cannastack service catalog publishes x402 metadata and transient semantics', async () => {
  const response = await manifestGET();
  const manifest = await response.json();

  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal(manifest.catalog_format, 'cannastack.service-catalog.v1');
  assert.equal(manifest.catalog_status, 'published');
  assert.equal(manifest.availability, 'not_asserted');
  assert.equal(manifest.published_paid_endpoints, ENDPOINTS.length);
  assert.equal(manifest.payment.official_protocol_manifest, false);
  assert.equal(manifest.boundaries.external_menu_data_access, false);
  assert.equal(manifest.boundaries.payment_network_access, true);
  assert.equal(manifest.boundaries.application_storage, false);
  assert.equal(manifest.boundaries.authorization_status, 'caller_attested_unverified');
  assert.deepEqual(
    manifest.endpoints.map((endpoint: { path: string }) => endpoint.path),
    ENDPOINTS.map((endpoint) => endpoint.path),
  );
  for (const [index, endpoint] of ENDPOINTS.entries()) {
    const offer = manifest.endpoints[index];
    assert.equal(offer.price, endpoint.price);
    assert.equal(offer.network, endpoint.network);
    assert.equal(offer.scheme, endpoint.scheme);
    assert.deepEqual(offer.request_schema, endpoint.request_schema);
    assert.deepEqual(offer.response_schema, endpoint.response_schema);
    assert.equal(offer.semantics.external_menu_data_used, false);
    assert.equal(offer.semantics.processing, 'transient_no_application_storage');
  }
  assert.doesNotMatch(JSON.stringify(manifest), /"examples?":/u);
});

test('llms.txt documents rights, file input, payment, boundaries, and legacy routes', async () => {
  const response = await llmsGET();
  const text = await response.text();

  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.match(text, /@authorized-menu-request\.json/u);
  assert.match(text, new RegExp(MENU_SCHEMA_VERSION, 'u'));
  assert.match(text, new RegExp(DATA_RIGHTS_VERSION, 'u'));
  assert.match(text, new RegExp(MENU_RULESET_VERSION, 'u'));
  assert.match(text, /caller-attested and unverified/iu);
  assert.match(text, /not written to application storage/iu);
  assert.match(text, /do not fetch external menu data/iu);
  assert.match(text, /PAYMENT-REQUIRED/u);
  assert.match(text, /payment_settlement_indeterminate/u);
  assert.match(text, /not an official protocol manifest/u);
  assert.match(text, /HTTP 410 Gone/);
  for (const endpoint of ENDPOINTS) assert.match(text, new RegExp(endpoint.path, 'u'));
  assert.doesNotMatch(text, /Example request|```json/iu);
});

test('root JSON reports the published catalog, versions, links, and boundaries', async () => {
  const request = new NextRequest('https://cannastack.0x402.sh/', {
    headers: { accept: 'application/json' },
  });
  const response = proxy(request);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.catalog_status, 'published');
  assert.equal(body.availability, 'not_asserted');
  assert.equal(body.published_paid_endpoints, ENDPOINTS.length);
  assert.deepEqual(
    body.endpoints.map((endpoint: { path: string }) => endpoint.path),
    ENDPOINTS.map((endpoint) => endpoint.path),
  );
  assert.equal(body.versions.request_schema, MENU_SCHEMA_VERSION);
  assert.equal(body.boundaries.external_menu_data_access, false);
  assert.equal(body.boundaries.payment_network_access, true);
  assert.equal(body.boundaries.application_storage, false);
  assert.equal(body.links.openapi, 'https://cannastack.0x402.sh/openapi.json');
});

test('unauthorized active input returns 403 before payment handling', async () => {
  const response = await activeNormalize(
    new NextRequest('https://cannastack.0x402.sh/api/v1/menu/normalize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schema_version: MENU_SCHEMA_VERSION,
        data_authorization: null,
        menus: [],
      }),
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(response.headers.has('payment-required'), false);
  assert.equal((await response.json()).error.code, 'data_authorization_required');
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
    assert.equal(body.published_paid_endpoints, ENDPOINTS.length, path);
  }
});

test('active and legacy preflights remain browser-readable', () => {
  const activeResponse = activeOptions();
  const legacyResponse = proxy(
    new NextRequest('https://cannastack.0x402.sh/api/strain-finder', {
      method: 'OPTIONS',
    }),
  );

  for (const response of [activeResponse, legacyResponse]) {
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.match(response.headers.get('access-control-allow-methods') ?? '', /POST/u);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
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
      url: `https://cannastack.0x402.sh${ENDPOINTS[0].path}`,
      description: ENDPOINTS[0].summary,
      mimeType: 'application/json',
    },
    accepts: [{
      scheme: 'exact',
      network: 'eip155:8453',
      asset: BASE_USDC,
      amount: '20000',
      payTo: `0x${'1'.repeat(40)}`,
      maxTimeoutSeconds: 300,
      extra: {},
    }],
  };
  const encoded = Buffer.from(JSON.stringify(challenge)).toString('base64');
  const sdkResponse = NextResponse.json(
    {},
    {
      status: 402,
      headers: {
        'payment-required': encoded,
        'payment-response': 'test-only-payment-header',
      },
    },
  );

  const response = withPaymentRequiredBody(sdkResponse);
  assert.equal(response.headers.get('payment-required'), encoded);
  assert.equal(response.headers.get('payment-response'), 'test-only-payment-header');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), challenge);
});

test('settlement-only payment failures are not exposed as repayable challenges', async () => {
  const sdkResponse = NextResponse.json({}, {
    status: 402,
    headers: { 'payment-response': 'test-settlement-response' },
  });

  const response = withPaymentRequiredBody(sdkResponse);
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('payment-required'), null);
  assert.equal(response.headers.get('payment-response'), 'test-settlement-response');
  assert.deepEqual(await response.json(), {
    ok: false,
    error: { code: 'payment_settlement_indeterminate' },
  });
});

test('malformed payment challenges are removed from normalized failures', async () => {
  const response = withPaymentRequiredBody(
    NextResponse.json({}, { status: 402, headers: { 'payment-required': 'invalid' } }),
  );
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('payment-required'), null);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: { code: 'payment_challenge_invalid' },
  });
});
