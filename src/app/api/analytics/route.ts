import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const sql = getDb();

    const [topEndpoints, topLocations, topStrains, recent, total] = await Promise.all([
      sql`
        SELECT endpoint, count(*) as cnt, round(avg(response_ms)) as avg_ms
        FROM request_log
        GROUP BY endpoint
        ORDER BY cnt DESC
      `,
      sql`
        SELECT location_query, count(*) as cnt
        FROM request_log
        WHERE location_query IS NOT NULL
        GROUP BY location_query
        ORDER BY cnt DESC
        LIMIT 10
      `,
      sql`
        SELECT params->>'strain' as strain, count(*) as cnt
        FROM request_log
        WHERE endpoint = 'strain-finder' AND params->>'strain' IS NOT NULL
        GROUP BY params->>'strain'
        ORDER BY cnt DESC
        LIMIT 10
      `,
      sql`
        SELECT endpoint, location_query, params, results_count, response_ms, created_at
        FROM request_log
        ORDER BY created_at DESC
        LIMIT 20
      `,
      sql`SELECT count(*) as cnt FROM request_log`,
    ]);

    return NextResponse.json({
      ok: true,
      total_requests: Number(total[0].cnt),
      by_endpoint: topEndpoints,
      top_locations: topLocations,
      top_strains: topStrains,
      recent,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
