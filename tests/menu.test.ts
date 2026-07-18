import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from '@x402/core/http';
import Ajv2020 from 'ajv/dist/2020.js';
import { NextRequest } from 'next/server';

import {
  MENU_LIMITS,
  validateMenuRequest,
  type CompareRequest,
  type NormalizeRequest,
  type RecommendRequest,
} from '../src/lib/menu-contract';
import { compareMenu, normalizeMenu, recommendMenu } from '../src/lib/menu';
import { ENDPOINTS } from '../src/lib/endpoints';
import {
  OPTIONS as normalizeOptions,
  POST as normalizePost,
} from '../src/app/api/v1/menu/normalize/route';
import { GET as openapiGET } from '../src/app/openapi.json/route';

const TEST_AUTHORIZATION = {
  version: 'cannastack.data-rights.v1',
  rights_basis: 'owner',
  submitter_has_rights: true,
  contains_personal_data: false,
} as const;

function testOffer(
  offer_id: string,
  amount = '1.00',
  value = '1',
  unit: 'mg' | 'g' | 'ml' | 'each' = 'g',
) {
  return {
    offer_id,
    price: { currency: 'USD', amount },
    package_size: { value, unit },
  };
}

function testItem(item_id: string, offer = testOffer(`OFFER_${item_id}`)) {
  return {
    item_id,
    name: `TEST ITEM ${item_id}`,
    category: 'flower',
    tags: ['test-required'],
    offers: [offer],
  };
}

type TestItemRecord = ReturnType<typeof testItem> & { brand?: string };

function testMenu(
  menu_id: string,
  items: TestItemRecord[] = [testItem(`ITEM_${menu_id}`)],
) {
  return { menu_id, menu_name: `TEST MENU ${menu_id}`, items };
}

function baseRequest(menus = [testMenu('A')]) {
  return {
    schema_version: 'cannastack.byom.v1',
    data_authorization: TEST_AUTHORIZATION,
    menus,
  };
}

function parsedNormalize(input: unknown): NormalizeRequest {
  const result = validateMenuRequest('normalize', input);
  assert.equal(result.success, true);
  if (!result.success) throw new Error('Expected a valid test request.');
  return result.data;
}

function parsedCompare(input: unknown): CompareRequest {
  const result = validateMenuRequest('compare', input);
  assert.equal(result.success, true);
  if (!result.success) throw new Error('Expected a valid test request.');
  return result.data;
}

function parsedRecommend(input: unknown): RecommendRequest {
  const result = validateMenuRequest('recommend', input);
  assert.equal(result.success, true);
  if (!result.success) throw new Error('Expected a valid test request.');
  return result.data;
}

test('normalization is canonical and deterministic across input ordering', () => {
  const menuA = testMenu('A', [
    {
      item_id: 'B',
      name: '  TEST   ITEM B  ',
      brand: 'TEST BRAND',
      category: 'Flowers',
      tags: [' TAG B ', 'tag a', 'TAG A'],
      offers: [testOffer('B', '10.01', '1000', 'mg'), testOffer('A', '5', '1', 'g')],
    },
    testItem('A'),
  ]);
  const menuB = testMenu('B');
  const forward = baseRequest([menuA, menuB]);
  const reversed = structuredClone(forward);
  reversed.menus.reverse();
  reversed.menus[1].items.reverse();
  reversed.menus[1].items[1].tags.reverse();
  reversed.menus[1].items[1].offers.reverse();

  const first = normalizeMenu(parsedNormalize(forward));
  const second = normalizeMenu(parsedNormalize(reversed));

  assert.deepEqual(first, second);
  assert.deepEqual(first.menus.map((menu) => menu.menu_id), ['A', 'B']);
  assert.deepEqual(first.menus[0].items.map((item) => item.item_id), ['A', 'B']);
  assert.deepEqual(first.menus[0].items[1].declared_tags, ['tag a', 'tag b']);
  assert.equal(first.menus[0].items[1].category, 'flower');
  assert.equal(first.menus[0].items[1].source_category, 'Flowers');
  assert.equal(first.menus[0].items[1].offers[0].declared_price.minor_units, 500);
  assert.equal(first.menus[0].items[1].offers[0].package_size?.base_amount, 1000);
  assert.match(first.provenance.canonical_input_sha256, /^sha256:[a-f0-9]{64}$/);
  assert.equal('timestamp' in first.provenance, false);
});

test('unknown categories map to other without name inference', () => {
  const request = baseRequest([
    testMenu('A', [{ ...testItem('A'), name: 'FLOWER', category: 'toString' }]),
  ]);
  const response = normalizeMenu(parsedNormalize(request));

  assert.equal(response.menus[0].items[0].category, 'other');
  assert.equal(response.menus[0].items[0].source_category, 'toString');
  assert.deepEqual(response.warnings, [
    { code: 'category_mapped_to_other', menu_id: 'A', item_id: 'A' },
  ]);
});

test('compare uses exact cents and exact unit ratios', () => {
  const menus = [
    testMenu('A', [
      testItem('A', testOffer('A', '1.00', '3', 'mg')),
      testItem('B', testOffer('B', '0.67', '2', 'mg')),
      testItem('C', testOffer('C', '0.01', '1', 'ml')),
    ]),
  ];
  const unitRequest = parsedCompare({
    ...baseRequest(menus),
    filter: { category: 'flower' },
    basis: { type: 'unit', dimension: 'mass' },
  });
  const packageRequest = parsedCompare({
    ...baseRequest(menus),
    filter: { category: 'flower' },
    basis: { type: 'package' },
  });

  const unit = compareMenu(unitRequest);
  const packagePrices = compareMenu(packageRequest);

  assert.deepEqual(unit.results.map((result) => result.item_id), ['A', 'B']);
  assert.deepEqual(unit.results[0].comparison, {
    type: 'unit',
    dimension: 'mass',
    base_unit: 'mg',
  });
  assert.deepEqual(packagePrices.results.map((result) => result.item_id), ['C', 'B', 'A']);
  assert.equal(packagePrices.results[0].declared_price.minor_units, 1);
  assert.equal(packagePrices.results[0].package_size?.dimension, 'volume');
});

test('recommendations apply constraints and return exact match codes', () => {
  const menus = [
    testMenu('A', [
      {
        ...testItem('A', testOffer('A', '5.00', '1', 'g')),
        brand: 'TEST BRAND A',
        tags: ['test-required', 'test-preferred'],
      },
      {
        ...testItem('B', testOffer('B', '3.00', '1', 'g')),
        tags: ['test-required', 'test-preferred'],
      },
      {
        ...testItem('C', testOffer('C', '1.00', '1', 'ml')),
        brand: 'TEST BRAND A',
        tags: ['test-required', 'test-preferred'],
      },
      {
        ...testItem('D', testOffer('D', '5.01', '1', 'g')),
        brand: 'TEST BRAND A',
        tags: ['test-required', 'test-preferred'],
      },
    ]),
  ];
  const request = parsedRecommend({
    ...baseRequest(menus),
    constraints: {
      category: 'flower',
      max_price: { currency: 'USD', amount: '5.00' },
      tags_all: ['TEST-REQUIRED'],
    },
    preferences: { brands: ['test brand a'], tags: ['TEST-PREFERRED'] },
    basis: { type: 'unit', dimension: 'mass' },
  });

  const response = recommendMenu(request);

  assert.deepEqual(response.results.map((result) => result.item_id), ['A', 'B']);
  assert.deepEqual(response.results[0].match_codes, [
    'preferred_brand_exact',
    'preferred_tag_exact',
  ]);
  assert.deepEqual(response.results[1].match_codes, ['preferred_tag_exact']);
  assert.equal('match_count' in response.results[0], false);
  assert.equal('summary' in response, false);
  assert.equal('reason' in response.results[0], false);
});

test('duplicate identifiers, collection limits, and unknown fields are rejected', () => {
  const duplicate = baseRequest([
    testMenu('A', [testItem('DUPLICATE'), testItem('DUPLICATE')]),
  ]);
  const duplicateResult = validateMenuRequest('normalize', duplicate);
  assert.equal(duplicateResult.success, false);
  if (duplicateResult.success) return;
  assert.equal(duplicateResult.error.status, 422);
  assert.equal(duplicateResult.error.issues[0].code, 'duplicate_id');

  const tooManyMenus = baseRequest(
    Array.from({ length: MENU_LIMITS.menus + 1 }, (_, index) => testMenu(`M${index}`)),
  );
  const limitResult = validateMenuRequest('normalize', tooManyMenus);
  assert.equal(limitResult.success, false);
  if (limitResult.success) return;
  assert.equal(limitResult.error.status, 413);

  const compactOverflow = {
    ...baseRequest(),
    menus: Array.from({ length: 100_000 }, () => null),
  };
  const compactResult = validateMenuRequest('normalize', compactOverflow);
  assert.equal(compactResult.success, false);
  if (compactResult.success) return;
  assert.equal(compactResult.error.status, 413);
  assert.equal(compactResult.error.issues[0].path, '/menus');

  const preferenceOverflow = {
    ...baseRequest(),
    menus: null,
    constraints: { category: 'flower' },
    preferences: { tags: Array.from({ length: 100_000 }, () => null) },
    basis: { type: 'package' },
  };
  const preferenceResult = validateMenuRequest('recommend', preferenceOverflow);
  assert.equal(preferenceResult.success, false);
  if (preferenceResult.success) return;
  assert.equal(preferenceResult.error.status, 413);

  const tooManyItems = baseRequest(
    Array.from({ length: 3 }, (_, menuIndex) =>
      testMenu(
        `TOTAL_${menuIndex}`,
        Array.from({ length: 167 }, (_, itemIndex) =>
          testItem(`M${menuIndex}_I${itemIndex}`),
        ),
      ),
    ),
  );
  const aggregateResult = validateMenuRequest('normalize', tooManyItems);
  assert.equal(aggregateResult.success, false);
  if (aggregateResult.success) return;
  assert.equal(aggregateResult.error.status, 413);
  assert.equal(aggregateResult.error.issues[0].path, '/menus/items');

  const unknownField = { ...baseRequest(), unexpected: true };
  const unknownResult = validateMenuRequest('normalize', unknownField);
  assert.equal(unknownResult.success, false);
  if (unknownResult.success) return;
  assert.equal(unknownResult.error.status, 422);
  assert.equal(unknownResult.error.issues[0].code, 'unknown_field');

  const unrelatedLimit = {
    ...baseRequest(),
    filter: { tags_all: Array.from({ length: MENU_LIMITS.filterValues + 1 }, () => 'tag') },
  };
  const unrelatedResult = validateMenuRequest('normalize', unrelatedLimit);
  assert.equal(unrelatedResult.success, false);
  if (!unrelatedResult.success) assert.equal(unrelatedResult.error.status, 422);
});

test('text validation rejects invisible controls and malformed Unicode', () => {
  for (const name of ['visible\u202Einvisible', 'zero\u200Bwidth', '\ud800']) {
    const request = baseRequest([testMenu('A', [{ ...testItem('A'), name }])]);
    const result = validateMenuRequest('normalize', request);
    assert.equal(result.success, false, JSON.stringify(name));
    if (!result.success) assert.equal(result.error.status, 422);
  }

  const expandingCase = baseRequest([
    testMenu('A', [{ ...testItem('A'), name: '\u0130'.repeat(160) }]),
  ]);
  assert.equal(validateMenuRequest('normalize', expandingCase).success, true);
});

test('money and package strings enforce published positive bounds', () => {
  const maximums = baseRequest([
    testMenu('A', [testItem('A', testOffer('A', '10000.00', '999999.999', 'g'))]),
  ]);
  assert.equal(validateMenuRequest('normalize', maximums).success, true);

  for (const amount of ['0', '0.00', '10000.01']) {
    const request = baseRequest();
    request.menus[0].items[0].offers[0].price.amount = amount;
    assert.equal(validateMenuRequest('normalize', request).success, false, amount);
  }

  for (const [value, unit] of [['1000000000', 'mg'], ['1000000', 'g']] as const) {
    const request = baseRequest([testMenu('A', [testItem('A', testOffer('A', '10000.00', value, unit))])]);
    assert.equal(validateMenuRequest('normalize', request).success, false, `${value}${unit}`);
  }
});

test('published JSON Schemas accept runtime inputs and outputs', () => {
  const normalizeInput = baseRequest();
  const compareInput = {
    ...baseRequest(),
    filter: { category: 'flower' },
    basis: { type: 'package' },
  };
  const recommendInput = {
    ...baseRequest(),
    constraints: { category: 'flower' },
    preferences: { tags: ['test-required'] },
    basis: { type: 'package' },
  };
  const cases = [
    [normalizeInput, normalizeMenu(parsedNormalize(normalizeInput))],
    [compareInput, compareMenu(parsedCompare(compareInput))],
    [recommendInput, recommendMenu(parsedRecommend(recommendInput))],
  ] as const;
  const ajv = new Ajv2020({ strict: false });

  ENDPOINTS.forEach((endpoint, index) => {
    const validateRequest = ajv.compile(endpoint.request_schema);
    const validateResponse = ajv.compile(endpoint.response_schema);
    assert.equal(validateRequest(cases[index][0]), true, JSON.stringify(validateRequest.errors));
    assert.equal(validateResponse(cases[index][1]), true, JSON.stringify(validateResponse.errors));
  });

  const validateNormalize = ajv.compile(ENDPOINTS[0].request_schema);
  const zeroPrice = structuredClone(normalizeInput);
  zeroPrice.menus[0].items[0].offers[0].price.amount = '0';
  assert.equal(validateNormalize(zeroPrice), false);

  const hiddenText = structuredClone(normalizeInput);
  hiddenText.menus[0].items[0].name = 'visible\u202Ehidden';
  assert.equal(validateNormalize(hiddenText), false);

  const expandingText = structuredClone(normalizeInput);
  expandingText.menus[0].items[0].name = '\u0130'.repeat(160);
  assert.equal(validateNormalize(expandingText), true);
  const expandingOutput = normalizeMenu(parsedNormalize(expandingText));
  assert.equal(ajv.compile(ENDPOINTS[0].response_schema)(expandingOutput), true);

  const blankText = structuredClone(normalizeInput);
  blankText.menus[0].items[0].name = '   ';
  assert.equal(validateNormalize(blankText), false);

  const paddedText = structuredClone(normalizeInput);
  paddedText.menus[0].items[0].name = `A${' '.repeat(160)}`;
  assert.equal(validateNormalize(paddedText), false);
  assert.equal(validateMenuRequest('normalize', paddedText).success, false);

  for (const separator of ['\u2028', '\u2029']) {
    const separatorText = structuredClone(normalizeInput);
    separatorText.menus[0].items[0].name = `${separator}A`;
    assert.equal(validateNormalize(separatorText), true);
    assert.equal(validateMenuRequest('normalize', separatorText).success, true);
  }

  const validateCompareResponse = ajv.compile(ENDPOINTS[1].response_schema);
  const wrongBasis: Record<string, unknown> = structuredClone(cases[1][1]);
  wrongBasis.basis = { type: 'unit', dimension: 'mass' };
  assert.equal(validateCompareResponse(wrongBasis), false);

  const unitInput = { ...compareInput, basis: { type: 'unit', dimension: 'mass' } };
  const unitOutput = compareMenu(parsedCompare(unitInput));
  assert.equal(validateCompareResponse(unitOutput), true);
  const missingPackage = structuredClone(unitOutput) as unknown as {
    results: { package_size: unknown }[];
  };
  missingPackage.results[0].package_size = null;
  assert.equal(validateCompareResponse(missingPackage), false);

  const invalidText = structuredClone(cases[1][1]) as unknown as {
    results: { name: string; comparison: Record<string, unknown> }[];
  };
  invalidText.results[0].name = ' ';
  assert.equal(validateCompareResponse(invalidText), false);
  invalidText.results[0].name = 'A'.repeat(160 * MENU_LIMITS.normalizedTextExpansionFactor + 1);
  assert.equal(validateCompareResponse(invalidText), false);
  invalidText.results[0].name = 'A';
  invalidText.results[0].comparison.price_minor_units = 1;
  assert.equal(validateCompareResponse(invalidText), false);

  const validateRecommendResponse = ajv.compile(ENDPOINTS[2].response_schema);
  const tooManyMatches = structuredClone(cases[2][1]) as unknown as {
    results: { match_codes: string[] }[];
  };
  tooManyMatches.results[0].match_codes = Array.from(
    { length: MENU_LIMITS.tagsPerItem + 2 },
    () => 'preferred_tag_exact',
  );
  assert.equal(validateRecommendResponse(tooManyMatches), false);
});

test('attestation and operation semantics use distinct uncharged errors', () => {
  const unauthorized = {
    ...baseRequest(),
    data_authorization: {
      ...TEST_AUTHORIZATION,
      submitter_has_rights: false,
    },
  };
  const authorizationResult = validateMenuRequest('normalize', unauthorized);
  assert.equal(authorizationResult.success, false);
  if (authorizationResult.success) return;
  assert.equal(authorizationResult.error.status, 403);

  const compareResult = validateMenuRequest('compare', {
    ...baseRequest(),
    filter: {},
    basis: { type: 'package' },
  });
  assert.equal(compareResult.success, false);
  if (compareResult.success) return;
  assert.equal(compareResult.error.status, 422);

  const recommendResult = validateMenuRequest('recommend', {
    ...baseRequest(),
    constraints: { category: 'other' },
    preferences: {},
    basis: { type: 'package' },
  });
  assert.equal(recommendResult.success, false);
  if (recommendResult.success) return;
  assert.equal(recommendResult.error.status, 422);

  const outputLimitResult = validateMenuRequest('compare', {
    ...baseRequest(),
    filter: { category: 'flower' },
    basis: { type: 'package' },
    limit: MENU_LIMITS.compareResults + 1,
  });
  assert.equal(outputLimitResult.success, false);
  if (outputLimitResult.success) return;
  assert.equal(outputLimitResult.error.status, 413);
});

function menuRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('https://cannastack.test/api/v1/menu/normalize', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

test('invalid requests are rejected before payment handling', async () => {
  const originalPayTo = process.env.CANNASTACK_PAY_TO;
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  process.env.CANNASTACK_PAY_TO = `0x${'1'.repeat(40)}`;
  globalThis.fetch = (async () => {
    networkCalls += 1;
    throw new Error('Unexpected test network call.');
  }) as typeof fetch;

  try {
    const malformed = await normalizePost(menuRequest('{'));
    assert.equal(malformed.status, 400);
    assert.equal(malformed.headers.get('payment-required'), null);

    const unauthorized = await normalizePost(
      menuRequest(JSON.stringify({ ...baseRequest(), data_authorization: null })),
    );
    assert.equal(unauthorized.status, 403);
    assert.equal(unauthorized.headers.get('payment-required'), null);

    const oversized = await normalizePost(
      menuRequest('{}', { 'content-length': String(MENU_LIMITS.bodyBytes + 1) }),
    );
    assert.equal(oversized.status, 413);
    assert.equal(oversized.headers.get('payment-required'), null);

    const chunkedOversized = await normalizePost(
      menuRequest(' '.repeat(MENU_LIMITS.bodyBytes + 1)),
    );
    assert.equal(chunkedOversized.status, 413);
    assert.equal(chunkedOversized.headers.get('payment-required'), null);

    const invalidAmount = baseRequest();
    invalidAmount.menus[0].items[0].offers[0].price.amount = '1e2';
    const semantic = await normalizePost(menuRequest(JSON.stringify(invalidAmount)));
    assert.equal(semantic.status, 422);
    assert.equal(semantic.headers.get('payment-required'), null);
    assert.equal(networkCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalPayTo === undefined) delete process.env.CANNASTACK_PAY_TO;
    else process.env.CANNASTACK_PAY_TO = originalPayTo;
  }
});

test('unsupported media and encodings are rejected before payment', async () => {
  const mediaType = await normalizePost(
    menuRequest(JSON.stringify(baseRequest()), { 'content-type': 'text/plain' }),
  );
  const encoding = await normalizePost(
    menuRequest(JSON.stringify(baseRequest()), { 'content-encoding': 'gzip' }),
  );

  assert.equal(mediaType.status, 415);
  assert.equal(encoding.status, 415);
  assert.equal(mediaType.headers.get('payment-required'), null);
  assert.equal(encoding.headers.get('payment-required'), null);
});

test('valid requests require explicit payment configuration', async () => {
  const originalPayTo = process.env.CANNASTACK_PAY_TO;
  const originalPreview = process.env.X402_PREVIEW_MODE;
  delete process.env.CANNASTACK_PAY_TO;
  delete process.env.X402_PREVIEW_MODE;
  try {
    const response = await normalizePost(menuRequest(JSON.stringify(baseRequest())));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: { code: 'payment_configuration_unavailable' },
    });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    if (originalPayTo === undefined) delete process.env.CANNASTACK_PAY_TO;
    else process.env.CANNASTACK_PAY_TO = originalPayTo;
    if (originalPreview === undefined) delete process.env.X402_PREVIEW_MODE;
    else process.env.X402_PREVIEW_MODE = originalPreview;
  }
});

test('x402 verifies, executes, and settles only a valid paid request', async () => {
  const originalPayTo = process.env.CANNASTACK_PAY_TO;
  const originalPreview = process.env.X402_PREVIEW_MODE;
  const originalFetch = globalThis.fetch;
  const facilitatorCalls: string[] = [];
  let settlementSucceeds = true;
  let settlementAvailable = true;
  let verificationAvailable = true;
  process.env.CANNASTACK_PAY_TO = `0x${'1'.repeat(40)}`;
  delete process.env.X402_PREVIEW_MODE;

  globalThis.fetch = (async (input, init) => {
    assert.ok(init?.signal);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    facilitatorCalls.push(new URL(url).pathname);
    if (url.endsWith('/supported')) {
      return Response.json({
        kinds: [
          { x402Version: 1, scheme: 'exact', network: 'base' },
          { x402Version: 2, scheme: 'exact', network: 'eip155:8453', extra: null },
        ],
        extensions: [],
        signers: {},
      });
    }
    if (url.endsWith('/verify')) {
      if (!verificationAvailable) {
        return Response.json(
          { isValid: false, invalidReason: 'service_unavailable', payer: null },
          { status: 503 },
        );
      }
      return Response.json({ isValid: true, payer: null });
    }
    if (url.endsWith('/settle')) {
      if (!settlementAvailable) {
        return Response.json({ error: 'unavailable' }, { status: 503 });
      }
      return Response.json(
        {
          success: settlementSucceeds,
          ...(settlementSucceeds ? {} : { errorReason: 'settlement_failed' }),
          payer: null,
          transaction: `0x${'3'.repeat(64)}`,
          network: 'eip155:8453',
          extra: {},
        },
        { status: settlementSucceeds ? 200 : 503 },
      );
    }
    throw new Error(`Unexpected facilitator path: ${url}`);
  }) as typeof fetch;

  try {
    const body = JSON.stringify(baseRequest());
    const unpaid = await normalizePost(menuRequest(body));
    const encodedChallenge = unpaid.headers.get('payment-required');
    assert.equal(unpaid.status, 402);
    assert.ok(encodedChallenge);

    const challenge = decodePaymentRequiredHeader(encodedChallenge);
    const openapi = await (await openapiGET()).json();
    const validateChallenge = new Ajv2020({
      strict: false,
      formats: { uri: true },
    }).compile(openapi.components.schemas.PaymentRequired);
    assert.equal(validateChallenge(challenge), true, JSON.stringify(validateChallenge.errors));
    assert.equal(validateChallenge({ ...challenge, accepts: [] }), false);
    const incompleteChallenge = structuredClone(challenge);
    delete (incompleteChallenge.accepts[0] as { amount?: string }).amount;
    assert.equal(validateChallenge(incompleteChallenge), false);
    const payment = encodePaymentSignatureHeader({
      x402Version: 2,
      resource: challenge.resource,
      accepted: challenge.accepts[0],
      payload: {},
    });
    const paid = await normalizePost(menuRequest(body, { 'payment-signature': payment }));
    const result = await paid.json();
    const settlementHeader = paid.headers.get('payment-response');

    assert.equal(paid.status, 200);
    assert.equal(result.operation, 'normalize');
    assert.ok(settlementHeader);
    const settlement = decodePaymentResponseHeader(settlementHeader);
    assert.equal(settlement.transaction, `0x${'3'.repeat(64)}`);
    assert.deepEqual(settlement.extra, {});
    assert.deepEqual(facilitatorCalls, ['/supported', '/verify', '/settle']);

    settlementSucceeds = false;
    const unsettled = await normalizePost(menuRequest(body, { 'payment-signature': payment }));
    assert.equal(unsettled.status, 502);
    assert.equal((await unsettled.json()).error.code, 'payment_settlement_indeterminate');
    const failedSettlementHeader = unsettled.headers.get('payment-response');
    assert.ok(failedSettlementHeader);
    assert.equal(
      decodePaymentResponseHeader(failedSettlementHeader).transaction,
      `0x${'3'.repeat(64)}`,
    );

    settlementSucceeds = true;
    settlementAvailable = false;
    const unknownSettlement = await normalizePost(
      menuRequest(body, { 'payment-signature': payment }),
    );
    assert.equal(unknownSettlement.status, 502);
    assert.equal((await unknownSettlement.json()).error.code, 'payment_settlement_indeterminate');
    assert.ok(unknownSettlement.headers.get('payment-response'));

    verificationAvailable = false;
    const unavailable = await normalizePost(menuRequest(body, { 'payment-signature': payment }));
    assert.equal(unavailable.status, 502);
    assert.equal((await unavailable.json()).error.code, 'payment_service_unavailable');
    assert.equal(unavailable.headers.get('payment-required'), null);

    const malformed = await normalizePost(menuRequest('{'));
    assert.equal(malformed.status, 400);
    assert.deepEqual(facilitatorCalls, [
      '/supported',
      '/verify',
      '/settle',
      '/verify',
      '/settle',
      '/verify',
      '/settle',
      '/verify',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalPayTo === undefined) delete process.env.CANNASTACK_PAY_TO;
    else process.env.CANNASTACK_PAY_TO = originalPayTo;
    if (originalPreview === undefined) delete process.env.X402_PREVIEW_MODE;
    else process.env.X402_PREVIEW_MODE = originalPreview;
  }
});

test('production never honors the payment preview bypass', async () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPayTo = process.env.CANNASTACK_PAY_TO;
  const originalPreview = process.env.X402_PREVIEW_MODE;
  mutableEnv.NODE_ENV = 'production';
  process.env.X402_PREVIEW_MODE = '1';
  delete process.env.CANNASTACK_PAY_TO;
  try {
    const response = await normalizePost(menuRequest(JSON.stringify(baseRequest())));
    assert.equal(response.status, 503);
  } finally {
    if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = originalNodeEnv;
    if (originalPayTo === undefined) delete process.env.CANNASTACK_PAY_TO;
    else process.env.CANNASTACK_PAY_TO = originalPayTo;
    if (originalPreview === undefined) delete process.env.X402_PREVIEW_MODE;
    else process.env.X402_PREVIEW_MODE = originalPreview;
  }
});

test('the paid handler processes only the validated original body', async () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPreview = process.env.X402_PREVIEW_MODE;
  mutableEnv.NODE_ENV = 'test';
  process.env.X402_PREVIEW_MODE = '1';
  try {
    const response = await normalizePost(menuRequest(JSON.stringify(baseRequest())));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.operation, 'normalize');
    assert.equal(body.provenance.external_menu_data_used, false);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = originalNodeEnv;
    if (originalPreview === undefined) delete process.env.X402_PREVIEW_MODE;
    else process.env.X402_PREVIEW_MODE = originalPreview;
  }
});

test('menu preflight returns browser-readable no-store CORS', () => {
  const response = normalizeOptions();
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.match(response.headers.get('access-control-allow-methods') ?? '', /POST/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('menu processing core has no data-source, database, or network imports', async () => {
  for (const file of ['src/lib/menu-contract.ts', 'src/lib/menu.ts']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /@\/lib\/(?:adapters|crawler|crawl-queue|db)/u, file);
    assert.doesNotMatch(source, /\bfetch\s*\(/u, file);
    assert.doesNotMatch(source, /https?:\/\//u, file);
  }
});
