import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireCrawlAuth } from '@/lib/crawl-auth';
import { enqueueCrawlRuns, queueStats } from '@/lib/crawl-queue';
import { enabledSources } from '@/lib/adapters';
import type { Metro } from '@/lib/types';

// Enqueue-only trigger: inserts pending crawl_runs rows and returns
// immediately. Execution happens in /api/crawl/worker, which claims pending
// runs off the queue (see docs/etl-ingestion.md).
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const denied = requireCrawlAuth(req);
  if (denied) return denied;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  const sql = getDb();

  const metros = (await sql`SELECT * FROM metros WHERE enabled = true ORDER BY id`) as Metro[];

  if (metros.length === 0) {
    return NextResponse.json({ ok: true, message: 'No enabled metros', enqueued: [], skipped: [] });
  }

  const { enqueued, skipped } = await enqueueCrawlRuns(sql, metros, enabledSources());
  const queue = await queueStats(sql);

  return NextResponse.json({
    ok: true,
    metros: metros.length,
    enqueued,
    skipped,
    queue,
    message: `Enqueued ${enqueued.length} run(s); ${skipped.length} already pending. Worker executes them.`,
  });
}
