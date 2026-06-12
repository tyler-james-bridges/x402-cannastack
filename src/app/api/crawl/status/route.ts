import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { queueStats } from '@/lib/crawl-queue';
import { apiHeaders, preflight } from '@/lib/api-response';

export const OPTIONS = preflight;

// Sentinel columns from each migration era. If any are missing, the deployed
// code is newer than the database schema (migrations didn't run) — the exact
// failure mode that once 500'd every paid endpoint in prod. Checked first and
// short-circuited, because the detailed queries below would themselves fail
// against a stale schema.
const EXPECTED_COLUMNS: Array<[string, string]> = [
  ['menu_items', 'available'],
  ['menu_items', 'source_item_key'],
  ['crawl_runs', 'claimed_at'],
  ['crawl_runs', 'attempts'],
];

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

    // Fetch all columns for the sentinel tables and compare in JS so
    // EXPECTED_COLUMNS stays the single source of truth.
    const sentinelTables = [...new Set(EXPECTED_COLUMNS.map(([t]) => t))];
    const presentColumns = await sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY(${sentinelTables})
    `;
    const present = new Set(presentColumns.map((c) => `${c.table_name}.${c.column_name}`));
    const missingColumns = EXPECTED_COLUMNS.map(([t, c]) => `${t}.${c}`).filter(
      (tc) => !present.has(tc),
    );
    const schema = {
      migrated: missingColumns.length === 0,
      missing_columns: missingColumns,
    };

    if (!schema.migrated) {
      return NextResponse.json(
        {
          ok: false,
          schema,
          error:
            'Database schema is behind the deployed code — run `npm run db:migrate` against this database. Detailed status is skipped because its queries need the missing columns.',
        },
        { headers: apiHeaders() },
      );
    }

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
      queueStats(sql),
    ]);

    return NextResponse.json(
      { ok: true, schema, metros, stats: stats[0], queue, recentCrawls, recentWarnings },
      { headers: apiHeaders() },
    );
  } catch (err) {
    console.error('[crawl/status] error:', err);
    return NextResponse.json(
      { ok: false, error: 'Status unavailable — check server logs.' },
      { status: 500, headers: apiHeaders() },
    );
  }
}
