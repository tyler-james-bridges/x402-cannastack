import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  // Imported after dotenv so DATABASE_URL/NEON_HTTP_FETCH_ENDPOINT are loaded.
  const { getDb } = await import('../src/lib/db');
  const { claimNextRun, failExhaustedRuns } = await import('../src/lib/crawl-queue');
  const { executeCrawlRun } = await import('../src/lib/crawler');
  const { getAdapterRegistry } = await import('../src/lib/adapters');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const sql = getDb();
  const adapters = getAdapterRegistry();

  const exhausted = await failExhaustedRuns(sql);
  if (exhausted > 0) console.log(`Marked ${exhausted} exhausted stuck run(s) failed`);

  let processed = 0;
  for (;;) {
    const claimed = await claimNextRun(sql);
    if (!claimed) break;

    const adapter = adapters[claimed.source];
    if (!adapter) {
      console.error(`Run ${claimed.runId}: no adapter for source '${claimed.source}', failing`);
      await sql`
        UPDATE crawl_runs
        SET status = 'failed',
            error_message = ${`No adapter registered for source '${claimed.source}'`},
            completed_at = NOW()
        WHERE id = ${claimed.runId}
      `;
      continue;
    }

    try {
      await executeCrawlRun(sql, claimed.runId, claimed.metro, adapter);
      processed++;
    } catch (err) {
      console.error(`Run ${claimed.runId} (${claimed.metro.name}/${claimed.source}) failed:`, err);
    }
  }

  console.log(`Queue drained: ${processed} run(s) executed`);
}

main().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
