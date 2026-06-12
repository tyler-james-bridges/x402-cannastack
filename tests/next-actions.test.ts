import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  nextForStrainFinder,
  nextForPriceCompare,
  nextForDealScout,
  nextForPriceHistory,
  type NextAction,
} from '../src/lib/next-actions';

function assertWellFormed(actions: NextAction[]) {
  assert.ok(actions.length > 0, 'at least one follow-up is always offered');
  for (const a of actions) {
    assert.equal(a.method, 'POST');
    assert.match(a.url, /^https:\/\/cannastack\.0x402\.sh\/api\/[a-z-]+$/);
    assert.ok(a.url.endsWith(a.endpoint), `url ${a.url} matches endpoint ${a.endpoint}`);
    assert.ok(a.price_usdc > 0);
    assert.ok(a.description.length > 0);
    // Bodies must be POSTable as-is: no undefined/null/empty values.
    for (const [k, v] of Object.entries(a.body)) {
      assert.ok(v !== undefined && v !== null && v !== '', `${a.action}.body.${k} is set`);
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
});

test('deal-scout results chain into compare and history; category defaults to flower', () => {
  const actions = nextForDealScout({ location: 'Las Vegas, NV' });
  assertWellFormed(actions);
  const compare = actions.find((a) => a.endpoint === 'price-compare');
  assert.ok(compare);
  assert.equal(compare.body.category, 'flower');
});

test('price-history without location still offers a dispensary trend', () => {
  const actions = nextForPriceHistory({ dispensary: 'Native Roots' });
  assertWellFormed(actions);
  assert.equal(actions[0].action, 'dispensary-trend');
  assert.equal(actions[0].body.days, 90);
});
