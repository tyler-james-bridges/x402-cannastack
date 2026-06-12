/**
 * Parsing tests for the Leafly adapter against recorded-shape fixtures (built
 * from the response interfaces the adapter targets — real-API conformance is
 * still unverified, see docs). fetch is stubbed; no network involved.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { LeaflyAdapter } from '../src/lib/adapters/leafly';
import { getAdapterRegistry, enabledSources } from '../src/lib/adapters';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.CRAWL_ENABLE_LEAFLY;
});

function stubFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return calls;
}

const dispensaryFixture = {
  stores: [
    {
      slug: 'green-leaf-phx',
      name: 'Green Leaf PHX',
      city: 'Phoenix',
      state: 'AZ',
      address1: '123 Main St',
      lat: 33.45,
      lon: -112.07,
      rating: 4.6,
      reviewCount: 321,
      type: 'dispensary',
      featureFlags: { hasDeals: true },
    },
  ],
};

const menuFixture = {
  items: [
    {
      name: 'Blue Dream',
      category: 'Flower',
      brandName: 'Acme Farms',
      subtitle: 'Sativa-dominant hybrid',
      pricing: { gram: 10, eighth: 30, ounce: 180 },
      strain: { genetics: 'hybrid' },
      isOrderable: true,
    },
    {
      name: 'Sleepy Gummies',
      category: 'Edibles',
      brandName: '',
      subtitle: '',
      pricing: { each: 25 },
    },
  ],
};

test('findDispensaries maps Leafly stores to RawDispensary', async () => {
  const calls = stubFetch(200, dispensaryFixture);
  const adapter = new LeaflyAdapter();

  const result = await adapter.findDispensaries(33.4484, -112.074, 20);

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /consumer-api\.leafly\.com.*dispensaries\/v2\/search/);
  const sent = JSON.parse(String(calls[0].init?.body));
  assert.equal(sent.lat, 33.4484);
  assert.equal(sent.radius, 20);

  assert.equal(result.length, 1);
  const d = result[0];
  assert.equal(d.source, 'leafly');
  assert.equal(d.sourceId, 'green-leaf-phx');
  assert.equal(d.name, 'Green Leaf PHX');
  assert.equal(d.lng, -112.07);
  assert.equal(d.hasDeals, true);
  assert.equal(d.webUrl, 'https://www.leafly.com/dispensary-info/green-leaf-phx');
});

test('fetchMenu maps Leafly pricing keys onto the price ladder', async () => {
  stubFetch(200, menuFixture);
  const adapter = new LeaflyAdapter();

  const items = await adapter.fetchMenu('green-leaf-phx');

  assert.equal(items.length, 2);
  assert.deepEqual(
    { name: items[0].name, gram: items[0].priceGram, eighth: items[0].priceEighth, ounce: items[0].priceOunce },
    { name: 'Blue Dream', gram: 10, eighth: 30, ounce: 180 },
  );
  assert.equal(items[0].genetics, 'hybrid');
  assert.equal(items[0].orderable, true);

  // 'each' pricing falls back to priceUnit; empty strings become undefined
  assert.equal(items[1].priceUnit, 25);
  assert.equal(items[1].brand, undefined);
  assert.equal(items[1].description, undefined);
  assert.equal(items[1].orderable, false);
});

test('non-OK responses degrade to empty results instead of throwing', async () => {
  stubFetch(403, { error: 'forbidden' });
  const adapter = new LeaflyAdapter();

  assert.deepEqual(await adapter.findDispensaries(33.4, -112.0, 15), []);
  assert.deepEqual(await adapter.fetchMenu('whatever'), []);
});

test('leafly is excluded from the crawl registry unless CRAWL_ENABLE_LEAFLY is set', () => {
  delete process.env.CRAWL_ENABLE_LEAFLY;
  assert.deepEqual(enabledSources(), ['weedmaps']);

  process.env.CRAWL_ENABLE_LEAFLY = '1';
  assert.deepEqual(enabledSources().sort(), ['leafly', 'weedmaps']);
  assert.equal(getAdapterRegistry().leafly.name, 'leafly');
});
