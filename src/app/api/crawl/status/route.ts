import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
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

  const sql = neon(databaseUrl);

  const [metros, recentCrawls, stats] = await Promise.all([
    sql`SELECT id, name, enabled FROM metros ORDER BY id`,
    sql`
      SELECT cl.metro_id, m.name as metro_name, cl.source, cl.dispensaries_found,
             cl.items_crawled, cl.items_new, cl.items_updated, cl.errors,
             cl.duration_ms, cl.started_at, cl.completed_at
      FROM crawl_log cl
      JOIN metros m ON m.id = cl.metro_id
      ORDER BY cl.started_at DESC
      LIMIT 10
    `,
    sql`
      SELECT
        (SELECT COUNT(*) FROM dispensaries) as total_dispensaries,
        (SELECT COUNT(*) FROM menu_items) as total_menu_items,
        (SELECT COUNT(*) FROM price_history) as total_price_changes,
        (SELECT MAX(completed_at) FROM crawl_log) as last_crawl
    `,
  ]);

  return NextResponse.json(
    { ok: true, metros, stats: stats[0], recentCrawls },
    { headers: apiHeaders() },
  );
}
