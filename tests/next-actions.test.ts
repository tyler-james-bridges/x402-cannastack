import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  nextForStrainFinder,
  nextForPriceCompare,
  nextForDealScout,
  nextForPriceHistory,
  type NextAction,
} from '../src/lib/next-actions';
import { findEndpoint } from '../src/lib/endpoints';

function assertWellFormed(actions: NextAction[]) {
  assert.ok(actions.length > 0, 'at least one follow-up is always offered');
  for (const a of actions) {
    const endpoint = findEndpoint(a.endpoint);
    assert.ok(endpoint, `${a.endpoint} is an advertised endpoint`);
    assert.equal(a.method, 'POST');
    assert.match(a.url, /^https:\/\/cannastack\.0x402\.sh\/api\/[a-z-]+$/);
    assert.ok(a.url.endsWith(a.endpoint), `url ${a.url} matches endpoint ${a.endpoint}`);
    assert.ok(a.price_usdc > 0);
    assert.ok(a.description.length > 0);
    // Bodies must be POSTable as-is: no undefined/null/empty values.
    for (const [k, v] of Object.entries(a.body)) {
      assert.ok(v !== undefined && v !== null && v !== '', `${a.action}.body.${k} is set`);
    }
    for (const param of endpoint.params.filter((param) => param.required)) {
      assert.ok(a.body[param.name], `${a.action}.body.${param.name} is required`);
    }
    if (a.endpoint === 'price-history') {
      assert.ok(a.body.strain || a.body.dispensary, `${a.action} has a history subject`);
    }
  }
}

test('strain-finder results chain into history, compare, and deals', () => {
  const actions = nextForStrainFinder({
    strain: 'Blue Dream',
    location: 'Denver, CO',
    radius: 15,
    resultCount: 8,
    topCategory: 'flower',
  });
  assertWellFormed(actions);
  assert.deepEqual(
    actions.map((a) => a.endpoint),
    ['price-history', 'price-compare', 'deal-scout'],
  );
  assert.deepEqual(actions[0].body, { strain: 'Blue Dream', location: 'Denver, CO', days: 30 });
});

test('empty strain-finder results offer a widen-radius retry', () => {
  const actions = nextForStrainFinder({
    strain: 'Rare Cut',
    location: 'Nowhere, KS',
    radius: 15,
    resultCount: 0,
  });
  assertWellFormed(actions);
  assert.equal(actions[0].action, 'widen-radius');
  assert.equal(actions[0].endpoint, 'strain-finder');
  assert.equal(actions[0].body.radius, 50);
});

test('price-compare results chain into finding the cheapest item', () => {
  const actions = nextForPriceCompare({
    category: 'vape',
    location: 'Las Vegas, NV',
    cheapestName: 'Slim Twist Battery',
  });
  assertWellFormed(actions);
  assert.equal(actions[0].endpoint, 'strain-finder');
  assert.equal(actions[0].body.strain, 'Slim Twist Battery');
  const history = actions.find((a) => a.endpoint === 'price-history');
  assert.equal(history?.body.strain, 'Slim Twist Battery');
});

test('price-compare without a product omits unsupported category history', () => {
  const actions = nextForPriceCompare({ category: 'vape', location: 'Las Vegas, NV' });
  assertWellFormed(actions);
  assert.equal(actions.some((a) => a.endpoint === 'price-history'), false);
});

test('deal-scout without a product compares the default flower category', () => {
  const actions = nextForDealScout({ location: 'Las Vegas, NV' });
  assertWellFormed(actions);
  const compare = actions.find((a) => a.endpoint === 'price-compare');
  assert.ok(compare);
  assert.equal(compare.body.category, 'flower');
  assert.equal(actions.some((a) => a.endpoint === 'price-history'), false);
});

test('deal-scout product results offer valid item history', () => {
  const actions = nextForDealScout({ location: 'Denver, CO', bestProductName: 'Gelato' });
  assertWellFormed(actions);
  assert.equal(actions.find((a) => a.endpoint === 'price-history')?.body.strain, 'Gelato');
});

test('price-history without location still offers a dispensary trend', () => {
  const actions = nextForPriceHistory({ dispensary: 'Native Roots' });
  assertWellFormed(actions);
  assert.equal(actions[0].action, 'dispensary-trend');
  assert.equal(actions[0].body.days, 90);
});

test('strain-only price history offers a longer valid trend', () => {
  const actions = nextForPriceHistory({ strain: 'Gelato 42' });
  assertWellFormed(actions);
  assert.equal(actions[0].action, 'strain-trend');
  assert.deepEqual(actions[0].body, { strain: 'Gelato 42', days: 90 });
});
