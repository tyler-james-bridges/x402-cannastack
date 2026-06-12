/**
 * Queue claim/reclaim semantics against a real Postgres, exercised through the
 * same @neondatabase/serverless driver the app uses (routed to local Postgres
 * via scripts/neon-local-proxy.ts). Skipped when no local Postgres is
 * reachable — set TEST_DATABASE_URL or run a default-config Postgres 16.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';

import { startNeonLocalProxy } from '../scripts/neon-local-proxy';
import { getDb } from '../src/lib/db';
import { runMigrations } from '../src/lib/migrations';
import { enqueueCrawlRuns, claimNextRun, failExhaustedRuns, queueStats } from '../src/lib/crawl-queue';
import { executeCrawlRun } from '../src/lib/crawler';
import type { DataSourceAdapter, Metro } from '../src/lib/types';

const PROXY_PORT = 4499;
const TEST_PG_URL =
  process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/cannastack_test';

async function pgAvailable(): Promise<boolean> {
  const client = new Client({ connectionString: TEST_PG_URL, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

test('crawl queue', async (t) => {
  if (!(await pgAvailable())) {
    t.skip(`no Postgres reachable at ${TEST_PG_URL}`);
    return;
  }

  process.env.DATABASE_URL = TEST_PG_URL;
  process.env.NEON_HTTP_FETCH_ENDPOINT = `http://127.0.0.1:${PROXY_PORT}/sql`;

  const proxy = await startNeonLocalProxy(PROXY_PORT, TEST_PG_URL);
  const sql = getDb();
  await runMigrations(sql);

  const metroA: Metro = { id: 0, name: 'Testville A', lat: 33.4, lng: -112.0, radius_mi: 15, enabled: true };
  const metroB: Metro = { id: 0, name: 'Testville B', lat: 39.7, lng: -104.9, radius_mi: 15, enabled: true };

  async function resetDb() {
    await sql`TRUNCATE crawl_item_events, crawl_warnings, price_history, menu_items, crawl_runs, crawl_log, dispensaries, metros RESTART IDENTITY CASCADE`;
    const a = await sql`INSERT INTO metros (name, lat, lng, radius_mi, enabled) VALUES (${metroA.name}, ${metroA.lat}, ${metroA.lng}, ${metroA.radius_mi}, true) RETURNING id`;
    const b = await sql`INSERT INTO metros (name, lat, lng, radius_mi, enabled) VALUES (${metroB.name}, ${metroB.lat}, ${metroB.lng}, ${metroB.radius_mi}, true) RETURNING id`;
    metroA.id = a[0].id as number;
    metroB.id = b[0].id as number;
    delete process.env.CRAWL_STUCK_AFTER_MINUTES;
    delete process.env.CRAWL_MAX_ATTEMPTS;
  }

  try {
    await t.test('enqueue creates pending runs and dedupes repeat triggers', async () => {
      await resetDb();
      const first = await enqueueCrawlRuns(sql, [metroA, metroB], ['weedmaps']);
      assert.equal(first.enqueued.length, 2);
      assert.equal(first.skipped.length, 0);

      const second = await enqueueCrawlRuns(sql, [metroA, metroB], ['weedmaps']);
      assert.equal(second.enqueued.length, 0);
      assert.equal(second.skipped.length, 2);

      const stats = await queueStats(sql);
      assert.equal(stats.pending, 2);
      assert.equal(stats.running, 0);
    });

    await t.test('enqueue fans out one run per metro per source', async () => {
      await resetDb();
      const result = await enqueueCrawlRuns(sql, [metroA, metroB], ['weedmaps', 'othersource']);
      assert.equal(result.enqueued.length, 4);

      const rows = await sql`SELECT metro_id, source FROM crawl_runs ORDER BY metro_id, source`;
      assert.deepEqual(
        rows.map((r) => `${r.metro_id}:${r.source}`),
        [`${metroA.id}:othersource`, `${metroA.id}:weedmaps`, `${metroB.id}:othersource`, `${metroB.id}:weedmaps`],
      );
    });

    await t.test('claim moves oldest pending run to running and increments attempts', async () => {
      await resetDb();
      await enqueueCrawlRuns(sql, [metroA], ['weedmaps']);
      await enqueueCrawlRuns(sql, [metroB], ['weedmaps']);

      const claimed = await claimNextRun(sql);
      assert.ok(claimed);
      assert.equal(claimed.metro.id, metroA.id);
      assert.equal(claimed.attempts, 1);
      assert.equal(claimed.source, 'weedmaps');

      const row = (await sql`SELECT status, claimed_at FROM crawl_runs WHERE id = ${claimed.runId}`)[0];
      assert.equal(row.status, 'running');
      assert.ok(row.claimed_at);
    });

    await t.test('concurrent claims never hand out the same run', async () => {
      await resetDb();
      await enqueueCrawlRuns(sql, [metroA, metroB], ['weedmaps']);

      const claims = await Promise.all(Array.from({ length: 5 }, () => claimNextRun(sql)));
      const got = claims.filter((c) => c !== null);
      const ids = new Set(got.map((c) => c!.runId));

      assert.equal(got.length, 2, 'exactly the two enqueued runs are claimed');
      assert.equal(ids.size, 2, 'no run is claimed twice');
    });

    await t.test('freshly claimed running run is not claimable again', async () => {
      await resetDb();
      await enqueueCrawlRuns(sql, [metroA], ['weedmaps']);
      const first = await claimNextRun(sql);
      assert.ok(first);

      const again = await claimNextRun(sql);
      assert.equal(again, null);
    });

    await t.test('stuck running run is reclaimed after the timeout, then capped by max attempts', async () => {
      await resetDb();
      process.env.CRAWL_MAX_ATTEMPTS = '2';
      await enqueueCrawlRuns(sql, [metroA], ['weedmaps']);

      const first = await claimNextRun(sql);
      assert.ok(first);

      // Simulate a worker that died 20 minutes ago (default stuck window is 15m)
      await sql`UPDATE crawl_runs SET claimed_at = NOW() - interval '20 minutes' WHERE id = ${first.runId}`;

      const reclaimed = await claimNextRun(sql);
      assert.ok(reclaimed, 'stalled run is offered again');
      assert.equal(reclaimed.runId, first.runId);
      assert.equal(reclaimed.attempts, 2);

      // Stall it again — attempts have hit the cap, so it is no longer claimable
      await sql`UPDATE crawl_runs SET claimed_at = NOW() - interval '20 minutes' WHERE id = ${first.runId}`;
      assert.equal(await claimNextRun(sql), null);

      const failed = await failExhaustedRuns(sql);
      assert.equal(failed, 1);
      const row = (await sql`SELECT status, error_message FROM crawl_runs WHERE id = ${first.runId}`)[0];
      assert.equal(row.status, 'failed');
      assert.match(row.error_message as string, /max attempts/);
    });

    await t.test('claimed run executes the staged ETL to completion and is idempotent on re-execution', async () => {
      await resetDb();
      const stubAdapter: DataSourceAdapter = {
        name: 'weedmaps',
        async findDispensaries() {
          return [
            { source: 'weedmaps', sourceId: 'disp-1', name: 'Stub Dispensary', city: 'Testville' },
          ];
        },
        async fetchMenu() {
          return [
            { sourceItemId: 'item-1', name: 'Blue Dream', category: 'flower', priceEighth: 30 },
            { sourceItemId: 'item-2', name: 'OG Kush', category: 'flower', priceEighth: 35 },
          ];
        },
      };

      await enqueueCrawlRuns(sql, [metroA], ['weedmaps']);
      const claimed = await claimNextRun(sql);
      assert.ok(claimed);

      const result = await executeCrawlRun(sql, claimed.runId, claimed.metro, stubAdapter);
      assert.equal(result.status, 'success');
      assert.equal(result.itemsNew, 2);

      const run = (await sql`SELECT status, completed_at FROM crawl_runs WHERE id = ${claimed.runId}`)[0];
      assert.equal(run.status, 'success');
      assert.ok(run.completed_at);

      // Re-executing the same run (as a reclaim would) must not duplicate rows
      await executeCrawlRun(sql, claimed.runId, claimed.metro, stubAdapter);
      const items = await sql`SELECT COUNT(*) AS n FROM menu_items`;
      assert.equal(Number(items[0].n), 2);
      const disps = await sql`SELECT COUNT(*) AS n FROM dispensaries`;
      assert.equal(Number(disps[0].n), 1);
    });

    await t.test('execution heartbeats claimed_at so in-progress runs are not reclaimed', async () => {
      await resetDb();
      const stubAdapter: DataSourceAdapter = {
        name: 'weedmaps',
        async findDispensaries() {
          return [{ source: 'weedmaps', sourceId: 'disp-1', name: 'Stub Dispensary' }];
        },
        async fetchMenu() {
          return [{ sourceItemId: 'item-1', name: 'Blue Dream', category: 'flower' }];
        },
      };

      await enqueueCrawlRuns(sql, [metroA], ['weedmaps']);
      const claimed = await claimNextRun(sql);
      assert.ok(claimed);

      // Simulate a long-running crawl whose claim is about to look stale
      await sql`UPDATE crawl_runs SET claimed_at = NOW() - interval '20 minutes' WHERE id = ${claimed.runId}`;
      await executeCrawlRun(sql, claimed.runId, claimed.metro, stubAdapter);

      const row = (await sql`SELECT claimed_at > NOW() - interval '1 minute' AS fresh FROM crawl_runs WHERE id = ${claimed.runId}`)[0];
      assert.equal(row.fresh, true, 'stage transitions refresh the liveness heartbeat');
    });
  } finally {
    await proxy.close();
  }
});
