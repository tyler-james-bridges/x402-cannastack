import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clampInt, likePattern, MAX_RADIUS_MI, MAX_RESULT_LIMIT } from '../src/lib/validate';
import { bestPrice, bestPriceValue } from '../src/lib/pricing';
import { CATEGORY_MAP, CATEGORY_OPTIONS } from '../src/lib/categories';
import { PRICE_USDC } from '../src/lib/analytics-types';
import { ENDPOINTS } from '../src/lib/endpoints';
import { GET as openapiGET } from '../src/app/openapi.json/route';
import { discoveryExtensionForDescription } from '../src/lib/x402';

test('clampInt clamps to bounds', () => {
  assert.equal(clampInt(999999, 15, 1, MAX_RADIUS_MI), 50);
  assert.equal(clampInt(-5, 15, 1, MAX_RADIUS_MI), 1);
  assert.equal(clampInt(25, 15, 1, MAX_RADIUS_MI), 25);
});

test('clampInt falls back on garbage input', () => {
  assert.equal(clampInt(undefined, 15, 1, 50), 15);
  assert.equal(clampInt('abc', 50, 1, MAX_RESULT_LIMIT), 50);
  assert.equal(clampInt(NaN, 30, 1, 365), 30);
  assert.equal(clampInt(null, 15, 1, 50), 15);
});

test('clampInt accepts numeric strings and truncates floats', () => {
  assert.equal(clampInt('20', 15, 1, 50), 20);
  assert.equal(clampInt(12.9, 15, 1, 50), 12);
});

test('likePattern wraps input and escapes ILIKE metacharacters', () => {
  assert.equal(likePattern('Blue Dream'), '%Blue Dream%');
  assert.equal(likePattern('100%'), '%100\\%%');
  assert.equal(likePattern('a_b'), '%a\\_b%');
  assert.equal(likePattern('a\\b'), '%a\\\\b%');
});

test('bestPrice walks the unit ladder in order', () => {
  assert.deepEqual(bestPrice({ price_unit: 10, price_eighth: 5 }), { price: 10, unit: 'unit' });
  assert.deepEqual(bestPrice({ price_unit: null, price_eighth: '28' }), {
    price: 28,
    unit: 'eighth',
  });
  assert.deepEqual(bestPrice({ price_ounce: 120 }), { price: 120, unit: 'ounce' });
  assert.deepEqual(bestPrice({}), { price: 0, unit: 'unknown' });
});

test('bestPrice ignores zero, negative, and non-numeric values', () => {
  assert.deepEqual(bestPrice({ price_unit: 0, price_eighth: -3, price_gram: 'n/a' }), {
    price: 0,
    unit: 'unknown',
  });
  assert.equal(bestPriceValue({ price_unit: 0, price_gram: 12 }), 12);
});

test('every advertised category option resolves in CATEGORY_MAP', () => {
  for (const option of CATEGORY_OPTIONS.split(',').map((s) => s.trim())) {
    assert.ok(CATEGORY_MAP[option], `option "${option}" missing from CATEGORY_MAP`);
  }
});

test('endpoint specs and analytics pricing agree', () => {
  for (const ep of ENDPOINTS) {
    assert.equal(
      PRICE_USDC[ep.name],
      ep.price_usdc,
      `PRICE_USDC and ENDPOINTS disagree for ${ep.name}`,
    );
  }
  assert.equal(Object.keys(PRICE_USDC).length, ENDPOINTS.length);
});

test('openapi includes x402scan registration metadata', async () => {
  const response = await openapiGET();
  const spec = await response.json();

  assert.equal(spec.info.title, 'Cannastack');
  assert.equal(spec.info.description, 'Cannabis menu data API for agents.');
  assert.equal(spec.info.contact.email, 'tylerscv22@gmail.com');
  assert.deepEqual(Object.keys(spec.paths).sort(), ENDPOINTS.map((ep) => ep.path).sort());
  assert.ok(spec.paths['/api/strain-finder'].post['x-payment-info']);
  assert.ok(spec.paths['/api/strain-finder'].post.responses['402']);
  assert.equal(spec.paths['/api/analytics'], undefined);
  assert.equal(spec.paths['/api/crawl/status'], undefined);
});

test('x402 payment requirements include runtime discovery schemas', () => {
  for (const ep of ENDPOINTS) {
    const extension = discoveryExtensionForDescription(`cannastack ${ep.name}: test`);
    assert.ok(extension?.bazaar?.schema.properties.input, `${ep.name} missing input schema`);
    assert.ok(extension?.bazaar?.schema.properties.output, `${ep.name} missing output schema`);
  }
});
