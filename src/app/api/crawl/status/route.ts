import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiHeaders, preflight } from '@/lib/api-response';

export const OPTIONS = preflight;

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      { error: 'DATABASE_URL not configured' },
      { status: 500, headers: apiHeaders() },
    );
  }

  try {
    const sql = getDb();

    const [metros, recentCrawls, recentWarnings, stats, queue] = await Promise.all([
      sql`SELECT id, name, enabled FROM metros ORDER BY id`,
      sql`
        SELECT cr.id, cr.metro_id, m.name as metro_name, cr.source, cr.status, cr.stage,
               cr.attempts, cr.claimed_at,
               cr.dispensaries_found, cr.items_extracted, cr.items_loaded,
               cr.items_new, cr.items_updated, cr.items_skipped, cr.items_stale,
               cr.warnings_count, cr.errors_count, cr.error_message,
               cr.started_at, cr.completed_at
        FROM crawl_runs cr
        JOIN metros m ON m.id = cr.metro_id
        ORDER BY cr.started_at DESC
        LIMIT 10
      `,
      sql`
        SELECT cw.crawl_run_id, cw.stage, cw.source_id, cw.item_name, cw.message, cw.created_at
        FROM crawl_warnings cw
        ORDER BY cw.created_at DESC
        LIMIT 20
      `,
      sql`
        SELECT
          (SELECT COUNT(*) FROM dispensaries) as total_dispensaries,
          (SELECT COUNT(*) FROM menu_items) as total_menu_items,
          (SELECT COUNT(*) FROM price_history) as total_price_changes,
          (SELECT COUNT(*) FROM menu_items WHERE available = false) as unavailable_menu_items,
          (SELECT COUNT(*) FROM crawl_runs WHERE status = 'failed') as failed_runs,
          (SELECT MAX(completed_at) FROM crawl_runs) as last_crawl
      `,
      sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') as pending_runs,
          COUNT(*) FILTER (WHERE status = 'running') as running_runs,
          MIN(started_at) FILTER (WHERE status = 'pending') as oldest_pending_at
        FROM crawl_runs
      `,
    ]);

    return NextResponse.json(
      { ok: true, metros, stats: stats[0], queue: queue[0], recentCrawls, recentWarnings },
      { headers: apiHeaders() },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: apiHeaders() });
  }
}
