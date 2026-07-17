import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GET as analyticsGet } from '../src/app/api/analytics/route';
import { GET as crawlGet } from '../src/app/api/crawl/route';
import { GET as crawlStatusGet } from '../src/app/api/crawl/status/route';
import { GET as crawlWorkerGet } from '../src/app/api/crawl/worker/route';
import { POST as dealScoutPost } from '../src/app/api/deal-scout/route';
import { POST as priceComparePost } from '../src/app/api/price-compare/route';
import { POST as priceHistoryPost } from '../src/app/api/price-history/route';
import { POST as strainFinderPost, OPTIONS } from '../src/app/api/strain-finder/route';
import { RETIRED_MESSAGE } from '../src/app/api/_retired';
import { enabledSources, getAdapterRegistry } from '../src/lib/adapters';
import {
  PURGE_DERIVED_SQL,
  PURGE_OPTIONAL_PAYMENT_SQL,
  hasPurgeConfirmation,
} from '../scripts/purge-derived-data';

const retiredHandlers = [
  analyticsGet,
  crawlGet,
  crawlStatusGet,
  crawlWorkerGet,
  dealScoutPost,
  priceComparePost,
  priceHistoryPost,
  strainFinderPost,
];

test('retired backend routes return direct uncached CORS 410 responses', async () => {
  for (const handler of retiredHandlers) {
    const response = await handler();
    assert.equal(response.status, 410);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.equal(response.headers.get('payment-required'), null);
    assert.deepEqual(await response.json(), {
      ok: false,
      status: 'retired',
      error: RETIRED_MESSAGE,
      active_paid_data_endpoints: 0,
      docs: 'https://cannastack.0x402.sh/docs',
    });
  }

  const preflight = OPTIONS();
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-methods') ?? '', /POST/);
});

test('no data source is registered by default', () => {
  assert.deepEqual(getAdapterRegistry(), {});
  assert.deepEqual(enabledSources(), []);
});

test('purge requires confirmation and covers only audited derived tables', () => {
  assert.equal(hasPurgeConfirmation([]), false);
  assert.equal(hasPurgeConfirmation(['--confirm']), true);

  const tables = [
    'crawl_item_events',
    'crawl_warnings',
    'price_history',
    'menu_items',
    'crawl_runs',
    'crawl_log',
    'dispensaries',
    'request_log',
  ];
  let previous = -1;
  for (const table of tables) {
    const position = PURGE_DERIVED_SQL.indexOf(`public.${table}`);
    assert.ok(position > previous, `${table} is present in safe purge order`);
    previous = position;
  }
  assert.doesNotMatch(PURGE_DERIVED_SQL, /public\.metros\b/);
  assert.match(PURGE_DERIVED_SQL, /RESTART IDENTITY/);
  assert.match(PURGE_OPTIONAL_PAYMENT_SQL, /to_regclass\('public\.payment_response_cache'\)/);
  assert.match(PURGE_OPTIONAL_PAYMENT_SQL, /to_regclass\('public\.payment_request_claims'\)/);
});
