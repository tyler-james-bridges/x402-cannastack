import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatStrainRunCard, routeStrainRunAsk } from '../src/lib/seal-strain-run';

test('routes strain and location asks to strain-finder', () => {
  const route = routeStrainRunAsk('find Blue Dream near Denver under $30');
  assert.equal(route.ok, true);
  assert.equal(route.endpoint, 'strain-finder');
  assert.deepEqual(route.body, { strain: 'Blue Dream', location: 'Denver' });
});

test('routes category deal asks to deal-scout', () => {
  const route = routeStrainRunAsk('best edibles deal in Tempe tonight');
  assert.equal(route.endpoint, 'deal-scout');
  assert.deepEqual(route.body, { location: 'Tempe', category: 'edibles' });
});

test('maps vibe-only asks to a sensible default', () => {
  const route = routeStrainRunAsk('something for sleep near Phoenix');
  assert.equal(route.endpoint, 'deal-scout');
  assert.deepEqual(route.body, { location: 'Phoenix', category: 'edibles' });
});

test('missing location becomes a graceful routing result', () => {
  const route = routeStrainRunAsk('find Blue Dream');
  assert.equal(route.ok, false);
  assert.equal(route.reason, 'missing_location');
  assert.match(route.message ?? '', /city|ZIP/);
});

test('formats top three dispensaries into a Strain Run card', () => {
  const card = formatStrainRunCard('find Blue Dream near Denver', {
    ok: true,
    location: { query: 'Denver', resolved: 'Denver, Colorado, USA' },
    results: [
      { dispensary: 'B Shop', distance_mi: 3.25, active_deal: false, matches: [{ name: 'Blue Dream', price: 32 }] },
      { dispensary: 'A Shop', distance_mi: 1.92, active_deal: true, matches: [{ name: 'Blue Dream', price: 28 }] },
      { dispensary: 'C Shop', distance_mi: 5, active_deal: false, matches: [{ name: 'Blue Dream', price: 40 }] },
      { dispensary: 'D Shop', distance_mi: 6, active_deal: false, matches: [{ name: 'Blue Dream', price: 45 }] },
    ],
  }, 'strain-finder');

  assert.equal(card.ok, true);
  assert.equal(card.header.resolved_location, 'Denver, Colorado, USA');
  assert.equal(card.rows.length, 3);
  assert.equal(card.rows[0].dispensary, 'A Shop');
  assert.equal(card.rows[0].distance_mi, 1.9);
  assert.match(card.summary, /Cheapest: A Shop at \$28/);
});

test('formats flat price-compare rows into card items', () => {
  const card = formatStrainRunCard('cheapest flower near Phoenix', {
    ok: true,
    location: { resolved: 'Phoenix, Arizona, USA' },
    results: [
      { dispensary: 'B Shop', name: 'House Flower', price: 30, dispensary_url: 'https://example.com/b' },
      { dispensary: 'A Shop', name: 'Value Flower', price: 24, dispensary_url: 'https://example.com/a' },
    ],
  }, 'price-compare');

  assert.equal(card.rows[0].dispensary, 'A Shop');
  assert.equal(card.rows[0].item, 'Value Flower');
  assert.equal(card.rows[0].price, 24);
  assert.equal(card.rows[0].url, 'https://example.com/a');
});

test('formats endpoint failures as a valid empty card', () => {
  const card = formatStrainRunCard('Blue Dream near Atlantis', {
    ok: false,
    error: 'Could not geocode location: "Atlantis".',
  }, 'strain-finder');
  assert.equal(card.ok, true);
  assert.deepEqual(card.rows, []);
  assert.match(card.summary, /Could not geocode/);
});
